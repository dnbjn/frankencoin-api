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
	// An indexer is "stale" if its latest indexed block is more than this many blocks
	// behind chain head. ~60s on mainnet — generous enough to absorb RPC/indexer poll skew,
	// tight enough that we don't serve hours-old data while a fresh source is available.
	private static readonly STALE_BLOCKS = 5n;

	private readonly logger = new Logger(IndexerHealthService.name);
	private primaryHealth: IndexerStatus | null = null;
	private backupHealth: IndexerStatus | null = null;
	private currentSource: 'primary' | 'backup' = 'primary';
	private lastLoggedSource: 'primary' | 'backup' | 'all-down' | null = null;

	constructor() {}

	/**
	 * Check health of an indexer against a known chain head.
	 * "Healthy" means responding AND within STALE_BLOCKS of chain head.
	 */
	private async checkIndexerHealth(
		indexerUrl: string,
		indexerType: 'primary' | 'backup',
		chainHead: bigint
	): Promise<IndexerStatus> {
		const startTime = Date.now();
		const previousHealth = indexerType === 'primary' ? this.primaryHealth : this.backupHealth;
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
			// Fetch indexer status. Set an explicit User-Agent — Cloudflare's WAF / Bot
			// Management runs *before* CF-Access and will 403 requests from datacenter IPs
			// that present Node's default `undici/x.y.z` UA, before the access token is even
			// evaluated. Sending a recognizable service UA avoids the bot-score block.
			const accessHeaders = indexerType === 'primary' ? ponderAccessHeaders() : {};
			const response = await fetch(`${indexerUrl}/status`, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
					'User-Agent': 'frankencoin-api-healthcheck/1.0',
					...accessHeaders,
				},
				signal: AbortSignal.timeout(5000), // 5 second timeout
			});

			status.latency = Date.now() - startTime;

			if (!response.ok) {
				// 403 on primary almost always means Cloudflare Access rejected the request —
				// either CF_ACCESS_CLIENT_ID/SECRET is missing/wrong, or the service token
				// has been revoked. Make the cause explicit in logs.
				if (response.status === 403 && indexerType === 'primary') {
					const id = process.env.CF_ACCESS_CLIENT_ID;
					const secret = process.env.CF_ACCESS_CLIENT_SECRET;
					const reason = !id || !secret
						? 'CF_ACCESS_CLIENT_ID/SECRET missing'
						: 'CF_ACCESS_CLIENT_ID/SECRET present but rejected (revoked or wrong tunnel?)';
					throw new Error(`HTTP 403 from Cloudflare Access — ${reason}`);
				}
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const data = await response.json();

			// Locate the mainnet entry by chain ID rather than display name. Ponder keys
			// status entries by chain name (derived from viem's mainnet.name = "Ethereum"),
			// so a string match works today but breaks silently if viem or Ponder ever
			// renames the entry. Each entry carries the numeric chain ID — match on that
			// and fall back to legacy string keys for older Ponder versions.
			let chainEntry: any = null;
			if (data && typeof data === 'object') {
				for (const value of Object.values(data)) {
					if (value && typeof value === 'object' && (value as any).id === 1) {
						chainEntry = value;
						break;
					}
				}
				if (!chainEntry) chainEntry = (data as any).Ethereum || (data as any).mainnet;
			}
			status.blockNumber = BigInt(chainEntry?.block?.number || chainEntry?.blockNumber || 0);
			status.blockTimestamp = chainEntry?.block?.timestamp || chainEntry?.blockTimestamp || 0;

			if (status.blockNumber > 0n) {
				const lag = chainHead > status.blockNumber ? chainHead - status.blockNumber : 0n;
				if (lag <= IndexerHealthService.STALE_BLOCKS) {
					status.isHealthy = true;
					status.consecutiveFailures = 0;
				} else {
					status.error = `Stale: ${lag} blocks behind chain head`;
					status.consecutiveFailures = (previousHealth?.consecutiveFailures ?? 0) + 1;
				}
			} else {
				status.error = 'Block number is 0';
				status.consecutiveFailures = (previousHealth?.consecutiveFailures ?? 0) + 1;
			}
		} catch (error) {
			status.error = error instanceof Error ? error.message : String(error);
			status.latency = Date.now() - startTime;
			status.consecutiveFailures = (previousHealth?.consecutiveFailures ?? 0) + 1;
		}

		// Log only on state transition (healthy → unhealthy or unhealthy → healthy)
		const wasHealthy = previousHealth?.isHealthy ?? true;
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
	 * Check both primary and backup indexers against the given chain head.
	 */
	async checkBothIndexers(chainHead: bigint): Promise<{
		primary: IndexerStatus;
		backup: IndexerStatus | null;
	}> {
		const primary = await this.checkIndexerHealth(CONFIG.indexer, 'primary', chainHead);

		let backup: IndexerStatus | null = null;
		if (CONFIG.backupIndexer) {
			backup = await this.checkIndexerHealth(CONFIG.backupIndexer, 'backup', chainHead);
		}

		return { primary, backup };
	}

	/**
	 * Determine which data source to use based on health.
	 *
	 * Picks the first fresh source, primary preferred. Applies stickiness: once on backup,
	 * stay on backup until primary is at least as fresh as backup. Prevents flapping when
	 * both sources are near chain head.
	 */
	determineDataSource(): 'primary' | 'backup' {
		const primaryFresh = this.primaryHealth?.isHealthy === true;
		const backupFresh = this.backupHealth?.isHealthy === true && !!CONFIG.backupIndexer;

		let source: 'primary' | 'backup';
		let logState: 'primary' | 'backup' | 'all-down';

		if (primaryFresh) {
			// Hysteresis: when already on backup with a fresh backup, only return to primary
			// once primary has caught up to (or passed) backup's block number.
			const sticky = this.currentSource === 'backup' && backupFresh;
			const primaryAtLeastAsFresh =
				!sticky || this.primaryHealth!.blockNumber >= this.backupHealth!.blockNumber;
			if (primaryAtLeastAsFresh) {
				source = 'primary';
				logState = 'primary';
			} else {
				source = 'backup';
				logState = 'backup';
			}
		} else if (backupFresh) {
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
				this.logger.warn('Primary indexer unhealthy or stale, switching to backup indexer');
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

		this.currentSource = source;
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
