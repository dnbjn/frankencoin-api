import { Injectable, Logger } from '@nestjs/common';
import { CONFIG, ponderAccessHeaders } from 'app.config';

export interface IndexerStatus {
	url: string;
	isHealthy: boolean;
	blockNumber: bigint;
	blockTimestamp: number;
	latency: number;
	consecutiveFailures: number;
	lastCheckedAt: Date;
	error?: string;
}

/**
 * IndexerHealthService - Monitors health of primary and backup indexers
 *
 * Features:
 * - Checks indexer status endpoints
 * - Detects when indexer is reindexing (block height decreasing)
 * - Tracks consecutive failures and recovery
 * - Provides health determination for failover logic
 */
@Injectable()
export class IndexerHealthService {
	private readonly logger = new Logger(IndexerHealthService.name);
	private primaryHealth: IndexerStatus | null = null;
	private backupHealth: IndexerStatus | null = null;
	private lastLoggedSource: 'primary' | 'backup' | 'all-down' | null = null;

	constructor() {}

	/**
	 * Check health of an indexer
	 */
	private async checkIndexerHealth(indexerUrl: string, indexerType: 'primary' | 'backup'): Promise<IndexerStatus> {
		const startTime = Date.now();
		const status: IndexerStatus = {
			url: indexerUrl,
			isHealthy: false,
			blockNumber: 0n,
			blockTimestamp: 0,
			latency: 0,
			consecutiveFailures: 0,
			lastCheckedAt: new Date(),
		};

		try {
			// Fetch indexer status
			const response = await fetch(`${indexerUrl}/status`, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
					...(indexerType === 'primary' ? ponderAccessHeaders() : {}),
				},
				signal: AbortSignal.timeout(5000), // 5 second timeout
			});

			status.latency = Date.now() - startTime;

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const data = await response.json();

			// Parse status response (Ponder returns chain names, e.g., "Ethereum")
			const ethereum = data.Ethereum || data.mainnet; // Try both for compatibility
			status.blockNumber = BigInt(ethereum?.block?.number || ethereum?.blockNumber || 0);
			status.blockTimestamp = ethereum?.block?.timestamp || ethereum?.blockTimestamp || 0;

			// Check if block number is reasonable (> 0)
			if (status.blockNumber > 0n) {
				status.isHealthy = true;
				status.consecutiveFailures = 0;
			} else {
				status.error = 'Block number is 0';
			}
		} catch (error) {
			status.error = error instanceof Error ? error.message : String(error);
			status.latency = Date.now() - startTime;

			// Increment consecutive failures from previous state
			const previousHealth = indexerType === 'primary' ? this.primaryHealth : this.backupHealth;
			status.consecutiveFailures = (previousHealth?.consecutiveFailures || 0) + 1;
		}

		// Log only on state transition (healthy → unhealthy or unhealthy → healthy)
		const previous = indexerType === 'primary' ? this.primaryHealth : this.backupHealth;
		const wasHealthy = previous?.isHealthy ?? true;
		if (wasHealthy && !status.isHealthy) {
			this.logger.warn(`Indexer ${indexerType} (${indexerUrl}) became unhealthy: ${status.error}`);
		} else if (!wasHealthy && status.isHealthy) {
			this.logger.log(`Indexer ${indexerType} (${indexerUrl}) recovered`);
		}

		// Store in memory
		if (indexerType === 'primary') {
			this.primaryHealth = status;
		} else {
			this.backupHealth = status;
		}

		return status;
	}

	/**
	 * Check both primary and backup indexers
	 */
	async checkBothIndexers(): Promise<{
		primary: IndexerStatus;
		backup: IndexerStatus | null;
	}> {
		const primary = await this.checkIndexerHealth(CONFIG.indexer, 'primary');

		let backup: IndexerStatus | null = null;
		if (CONFIG.backupIndexer) {
			backup = await this.checkIndexerHealth(CONFIG.backupIndexer, 'backup');
		}

		return { primary, backup };
	}

	/**
	 * Determine which data source to use based on health
	 */
	determineDataSource(): 'primary' | 'backup' {
		let source: 'primary' | 'backup';
		let logState: 'primary' | 'backup' | 'all-down';

		if (this.primaryHealth?.isHealthy) {
			source = 'primary';
			logState = 'primary';
		} else if (this.backupHealth?.isHealthy && CONFIG.backupIndexer) {
			source = 'backup';
			logState = 'backup';
		} else {
			source = 'primary';
			logState = 'all-down';
		}

		// Suppress logging until at least one health check has completed,
		// otherwise startup-phase queries would log "all indexers unhealthy" before any check ran.
		const haveCheckedAny = this.primaryHealth !== null || this.backupHealth !== null;
		if (haveCheckedAny && logState !== this.lastLoggedSource) {
			if (logState === 'backup') {
				this.logger.warn('Primary indexer unhealthy, switching to backup indexer');
			} else if (logState === 'all-down') {
				if (CONFIG.backupIndexer) {
					this.logger.error('Both indexers unhealthy - will keep attempting primary');
				} else {
					this.logger.error('Primary indexer unhealthy and no backup configured - will keep attempting primary');
				}
			} else if (this.lastLoggedSource !== null) {
				this.logger.log('Primary indexer healthy, switching back to primary');
			}
			this.lastLoggedSource = logState;
		}

		return source;
	}

	/**
	 * Get current health status
	 */
	getHealthStatus(): {
		primary: IndexerStatus | null;
		backup: IndexerStatus | null;
		currentSource: 'primary' | 'backup';
	} {
		return {
			primary: this.primaryHealth,
			backup: this.backupHealth,
			currentSource: this.determineDataSource(),
		};
	}
}
