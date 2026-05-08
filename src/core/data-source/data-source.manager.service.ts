import { Injectable, Logger } from '@nestjs/common';
import { IndexerHealthService } from './indexer-health.service';
import { PONDER_CLIENT, PONDER_CLIENT_BACKUP } from 'app.config';
import { DocumentNode, TypedDocumentNode } from '@apollo/client/core';

export type DataSource = 'primary' | 'backup';

export interface QueryOptions {
	query: DocumentNode | TypedDocumentNode<any, any>;
	variables?: any;
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
		const preferred = this.determineSource();
		const order: DataSource[] =
			preferred === 'backup' && PONDER_CLIENT_BACKUP
				? ['backup', 'primary']
				: PONDER_CLIENT_BACKUP
					? ['primary', 'backup']
					: ['primary'];

		let lastError: unknown;
		for (const source of order) {
			try {
				const result =
					source === 'primary' ? await this.queryPrimary<T>(options) : await this.queryBackup<T>(options);

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

		this.logger.error(
			`Query failed on all indexers: ${lastError instanceof Error ? lastError.message : String(lastError)}`
		);
		return null;
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
