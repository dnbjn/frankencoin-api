import { Injectable, Logger } from '@nestjs/common';
import { IndexerHealthService } from './indexer-health.service';
import { PONDER_CLIENT, PONDER_CLIENT_BACKUP } from 'app.config';
import { DocumentNode, TypedDocumentNode } from '@apollo/client/core';

export type DataSource = 'primary' | 'backup';

export interface QueryOptions {
	query: DocumentNode | TypedDocumentNode<any, any>;
	variables?: any;
	chainId?: number;
	preferBackup?: boolean;
	mergeBackupChainItems?: {
		rootField: string;
		orderBy?: string;
		orderDirection?: 'asc' | 'desc';
		limit?: number;
	};
}

/**
 * DataSourceManagerService - Coordinates two-tier failover architecture
 *
 * Query Priority:
 * 1. Primary Indexer (if healthy)
 * 2. Backup Indexer (if primary down and backup healthy)
 *
 * Features:
 * - Automatic failover based on indexer health
 * - Tracks current active data source
 * - Data cached in-memory by individual services
 */
@Injectable()
export class DataSourceManagerService {
	private static readonly BACKUP_FIRST_CHAIN_IDS = new Set([146, 42161]);

	private readonly logger = new Logger(DataSourceManagerService.name);
	private lastServedSource: DataSource | null = null;

	constructor(private readonly indexerHealth: IndexerHealthService) {}

	/**
	 * Determine which data source to use
	 */
	determineSource(): DataSource {
		return this.indexerHealth.determineDataSource();
	}

	/**
	 * Query with automatic failover
	 * Tries the preferred indexer first, then the other one. Returns null if both fail.
	 */
	async queryWithFailover<T = any>(options: QueryOptions): Promise<T | null> {
		if (options.mergeBackupChainItems) {
			return this.queryWithBackupChainItemMerge<T>(options);
		}

		const preferred = this.determineSource();
		const shouldPreferBackup =
			(options.preferBackup ||
				(options.chainId != undefined && DataSourceManagerService.BACKUP_FIRST_CHAIN_IDS.has(options.chainId))) &&
			!!PONDER_CLIENT_BACKUP;
		const order: DataSource[] =
			shouldPreferBackup || (preferred === 'backup' && PONDER_CLIENT_BACKUP)
				? ['backup', 'primary']
				: PONDER_CLIENT_BACKUP
					? ['primary', 'backup']
					: ['primary'];

		let lastError: unknown;
		for (const source of order) {
			try {
				const result = source === 'primary' ? await this.queryPrimary<T>(options) : await this.queryBackup<T>(options);

				// Log on transition, and on the very first served query if it's not the primary.
				if (this.lastServedSource === null) {
					if (source !== 'primary') {
						this.logger.warn(`Initial query served from ${source} indexer`);
					}
				} else if (this.lastServedSource !== source) {
					this.logger.warn(`Query failover: now serving from ${source} (previously ${this.lastServedSource})`);
				}
				this.lastServedSource = source;

				return result;
			} catch (err) {
				lastError = err;
				this.logger.warn(`Query failed on ${source}: ${err instanceof Error ? err.message : String(err)}`);
			}
		}

		this.logger.error(`Query failed on all indexers: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
		return null;
	}

	private async queryWithBackupChainItemMerge<T = any>(options: QueryOptions): Promise<T | null> {
		const mergeOptions = options.mergeBackupChainItems!;
		const baseOptions = { ...options, mergeBackupChainItems: undefined };
		const primaryData = await this.queryWithFailover<T>(baseOptions);

		if (!PONDER_CLIENT_BACKUP) return primaryData;

		let backupData: T | null = null;
		try {
			backupData = await this.queryBackup<T>(baseOptions);
		} catch (err) {
			this.logger.warn(`Backup chain override query failed: ${err instanceof Error ? err.message : String(err)}`);
			return primaryData;
		}

		if (!primaryData) return backupData;
		if (!backupData) return primaryData;

		return this.mergeBackupChainItems(primaryData, backupData, mergeOptions);
	}

	private mergeBackupChainItems<T = any>(primaryData: T, backupData: T, options: NonNullable<QueryOptions['mergeBackupChainItems']>): T {
		const primaryRoot = (primaryData as any)?.[options.rootField];
		const backupRoot = (backupData as any)?.[options.rootField];
		if (!primaryRoot || !backupRoot) {
			this.logger.warn(`Cannot merge backup chain items: root field "${options.rootField}" not found`);
			return primaryData;
		}

		const primaryItems = Array.isArray(primaryRoot?.items) ? primaryRoot.items : [];
		const backupItems = Array.isArray(backupRoot?.items) ? backupRoot.items : [];

		const primaryWithoutOverrideChains = primaryItems.filter(
			(item) => !DataSourceManagerService.BACKUP_FIRST_CHAIN_IDS.has(Number(item?.chainId))
		);
		const backupOverrideChains = backupItems.filter((item) =>
			DataSourceManagerService.BACKUP_FIRST_CHAIN_IDS.has(Number(item?.chainId))
		);
		const items = [...primaryWithoutOverrideChains, ...backupOverrideChains];

		if (options.orderBy) {
			items.sort((a, b) => {
				const comparison = this.compareOrderValue(a?.[options.orderBy!], b?.[options.orderBy!]);
				return options.orderDirection?.toLowerCase() === 'desc' ? -comparison : comparison;
			});
		}

		const limitedItems = options.limit == undefined ? items : items.slice(0, options.limit);

		return {
			...(primaryData as any),
			[options.rootField]: {
				...primaryRoot,
				items: limitedItems,
			},
		};
	}

	private compareOrderValue(a: unknown, b: unknown): number {
		if (a == undefined && b == undefined) return 0;
		if (a == undefined) return -1;
		if (b == undefined) return 1;

		if (typeof a === 'number' && typeof b === 'number') return a - b;

		const aString = String(a);
		const bString = String(b);
		if (/^-?\d+$/.test(aString) && /^-?\d+$/.test(bString)) {
			const aBig = BigInt(aString);
			const bBig = BigInt(bString);
			return aBig > bBig ? 1 : aBig < bBig ? -1 : 0;
		}

		return aString.localeCompare(bString);
	}

	/**
	 * Query primary indexer
	 */
	private async queryPrimary<T = any>(options: QueryOptions): Promise<T> {
		this.logger.debug('Querying primary indexer');
		const result = await PONDER_CLIENT.query({
			query: options.query,
			variables: options.variables,
			fetchPolicy: 'no-cache',
		});

		return result.data as T;
	}

	/**
	 * Query backup indexer
	 */
	private async queryBackup<T = any>(options: QueryOptions): Promise<T> {
		if (!PONDER_CLIENT_BACKUP) {
			throw new Error('Backup indexer not configured');
		}

		this.logger.debug('Querying backup indexer');
		const result = await PONDER_CLIENT_BACKUP.query({
			query: options.query,
			variables: options.variables,
			fetchPolicy: 'no-cache',
		});

		return result.data as T;
	}
}
