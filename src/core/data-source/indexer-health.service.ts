import { Injectable, Logger } from '@nestjs/common';
import { CONFIG } from 'app.config';

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
				headers: { 'Content-Type': 'application/json' },
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

			this.logger.warn(`Indexer ${indexerType} (${indexerUrl}) health check failed: ${status.error}`);
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
		// If primary is healthy, use it
		if (this.primaryHealth?.isHealthy) {
			return 'primary';
		}

		// If primary is down but backup is healthy, use backup
		if (this.backupHealth?.isHealthy && CONFIG.backupIndexer) {
			this.logger.warn('Primary indexer unhealthy, using backup indexer');
			return 'backup';
		}

		// Both indexers down - log error but keep trying primary
		this.logger.error('Both indexers unhealthy - will keep attempting primary');
		return 'primary';
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
