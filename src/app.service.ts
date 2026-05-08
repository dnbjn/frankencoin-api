import { ChainId } from '@frankencoin/zchf';
import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { VIEM_CONFIG } from 'app.config';
import { ChallengesService } from 'modules/challenges/challenges.service';
import { EcosystemFpsService } from 'modules/ecosystem/ecosystem.fps.service';
import { EcosystemFrankencoinService } from 'modules/ecosystem/ecosystem.frankencoin.service';
import { EcosystemMinterService } from 'modules/ecosystem/ecosystem.minter.service';
import { PositionsService } from 'modules/positions/positions.service';
import { PricesService } from 'modules/prices/prices.service';
import { SavingsCoreService } from 'modules/savings/savings.core.service';
import { SavingsLeadrateService } from 'modules/savings/savings.leadrate.service';
import { TelegramService } from 'integrations/telegram/telegram.service';
import { TransferReferenceService } from 'modules/transfer/transfer.reference.service';
import { IndexerHealthService } from 'core/data-source/indexer-health.service';
import { mainnet } from 'viem/chains';

export const INDEXING_TIMEOUT_COUNT: number = 3;
export const POLLING_DELAY: number = 6_000; // e.g. 6000ms (= 6sec)
export const BLOCK_HEIGHT_TOLERANCE: number = 2; // Allow indexer to be up to 2 blocks behind

export type IndexerStatus = {
	id: ChainId;
	block: {
		number: number;
		timestamp: number;
	};
};
export type IndexerStatusObject = {
	[key: string]: IndexerStatus;
};

const MIN = 60_000;

@Injectable()
export class ApiService {
	private readonly logger = new Logger(this.constructor.name);
	private indexing: boolean = false;
	private indexingTimeoutCount: number = 0;
	private fetchedBlockheight: number = 0;
	private lastRun: Record<string, number> = {};

	constructor(
		private readonly minter: EcosystemMinterService,
		private readonly positions: PositionsService,
		private readonly prices: PricesService,
		private readonly frankencoin: EcosystemFrankencoinService,
		private readonly fps: EcosystemFpsService,
		private readonly challenges: ChallengesService,
		private readonly telegram: TelegramService,
		private readonly leadrate: SavingsLeadrateService,
		private readonly savings: SavingsCoreService,
		private readonly transferRef: TransferReferenceService,
		private readonly indexerHealth: IndexerHealthService
	) {
		setTimeout(() => this.updateBlockheight(), 100);
	}

	private guard(key: string, intervalMs: number): boolean {
		const now = Date.now();
		if ((this.lastRun[key] ?? 0) + intervalMs > now) return false;
		this.lastRun[key] = now;
		return true;
	}

	async updateWorkflow() {
		this.logger.debug(`Fetching blockheight: ${this.fetchedBlockheight}`);
		const promises: Promise<any>[] = [];

		if (this.guard('minters', 5 * MIN)) promises.push(this.minter.updateMinters());
		if (this.guard('positionsV1', MIN)) promises.push(this.positions.updatePositonV1s());
		if (this.guard('positionsV2', MIN)) promises.push(this.positions.updatePositonV2s());
		if (this.guard('mintingV1', 5 * MIN)) promises.push(this.positions.updateMintingUpdateV1s());
		if (this.guard('mintingV2', 5 * MIN)) promises.push(this.positions.updateMintingUpdateV2s());
		if (this.guard('prices', MIN)) promises.push(this.prices.updatePrices());
		if (this.guard('keyValues', 5 * MIN)) promises.push(this.frankencoin.updateEcosystemKeyValues());
		if (this.guard('erc20Status', 5 * MIN)) promises.push(this.frankencoin.updateEcosystemERC20Status());
		if (this.guard('fps', 5 * MIN)) promises.push(this.fps.updateFpsInfo());
		if (this.guard('leaRates', 5 * MIN)) promises.push(this.leadrate.updateLeadrateRates());
		if (this.guard('leaProposals', 5 * MIN)) promises.push(this.leadrate.updateLeadrateProposals());
		if (this.guard('savingsStatus', 5 * MIN)) promises.push(this.savings.updateSavingsStatus());
		if (this.guard('savingsRank', 10 * MIN)) promises.push(this.savings.updateSavingsRank());
		promises.push(this.challenges.updateChallengeV1s());
		promises.push(this.challenges.updateChallengeV2s());
		promises.push(this.challenges.updateBidV1s());
		promises.push(this.challenges.updateBidV2s());
		promises.push(this.challenges.updateChallengesPrices());
		if (this.guard('transferRef', 10 * MIN)) promises.push(this.transferRef.updateReferences());
		promises.push(this.telegram.updateTelegram());

		return Promise.all(promises);
	}

	@Interval(POLLING_DELAY)
	async updateBlockheight() {
		// Get blockchain block height
		const blockHeight: number = parseInt((await VIEM_CONFIG[mainnet.id].getBlockNumber()).toString());

		// Check health of both indexers
		const { primary, backup } = await this.indexerHealth.checkBothIndexers();

		// Determine which indexer to use
		const currentSource = this.indexerHealth.determineDataSource();
		// Get the active indexer status
		const activeIndexer = currentSource === 'primary' ? primary : backup;

		if (!activeIndexer || !activeIndexer.isHealthy) {
			this.logger.warn('No healthy indexer available');
			return;
		}

		// Check if indexer is caught up with blockchain (with tolerance)
		const indexerBlockNumber = Number(activeIndexer.blockNumber);
		const blockDifference = blockHeight - indexerBlockNumber;
		if (blockDifference > BLOCK_HEIGHT_TOLERANCE) {
			this.logger.warn(
				`Indexer is not ready (blockchain: ${blockHeight}, indexer: ${indexerBlockNumber}, lag: ${blockDifference} blocks)`
			);
			return;
		}

		// Run update workflow
		this.indexingTimeoutCount += 1;
		if (blockHeight > this.fetchedBlockheight && !this.indexing) {
			this.indexing = true;
			await this.updateWorkflow();
			this.indexingTimeoutCount = 0;
			this.fetchedBlockheight = blockHeight;
			this.indexing = false;
		}
		if (this.indexingTimeoutCount >= INDEXING_TIMEOUT_COUNT && this.indexing) {
			this.indexingTimeoutCount = 0;
			this.indexing = false;
		}
	}
}
