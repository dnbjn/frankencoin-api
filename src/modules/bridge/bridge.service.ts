import { gql } from '@apollo/client/core';
import { Injectable, Logger } from '@nestjs/common';
import { PONDER_CLIENT } from 'app.config';
import {
	ApiCCIPChain,
	ApiCCIPChains,
	ApiCCIPProposal,
	ApiCCIPProposals,
	CCIPAdminChainQuery,
	CCIPAdminProposalQuery,
} from './bridge.types';

@Injectable()
export class BridgeService {
	private readonly logger = new Logger(this.constructor.name);
	private fetchedProposals: ApiCCIPProposal[] = [];
	private fetchedChains: ApiCCIPChain[] = [];

	getProposals(): ApiCCIPProposals {
		return { list: this.fetchedProposals };
	}

	getPendingProposals(): ApiCCIPProposal[] {
		return this.fetchedProposals.filter((p) => p.status === 'Pending');
	}

	getDeniedProposals(): ApiCCIPProposal[] {
		return this.fetchedProposals.filter((p) => p.deniedAt !== null);
	}

	getEnactedProposals(): ApiCCIPProposal[] {
		return this.fetchedProposals.filter((p) => p.enactedAt !== null);
	}

	getChains(): ApiCCIPChains {
		return { list: this.fetchedChains };
	}

	async updateProposals() {
		this.logger.debug('Updating CCIP proposals');

		const response = await PONDER_CLIENT.query<{
			cCIPAdminProposals: { items: CCIPAdminProposalQuery[] };
		}>({
			fetchPolicy: 'no-cache',
			query: gql`
				query {
					cCIPAdminProposals(orderBy: "created", orderDirection: "desc", limit: 1000) {
						items {
							chainId
							hash
							proposer
							type
							deadline
							status
							details
							created
							txHash
							deniedAt
							deniedTxHash
							enactedAt
							enactedTxHash
						}
					}
				}
			`,
		});

		if (!response.data?.cCIPAdminProposals?.items) {
			this.logger.warn('No cCIPAdminProposals data found.');
			return;
		}

		this.fetchedProposals = response.data.cCIPAdminProposals.items.map((r) => ({
			chainId: r.chainId,
			hash: r.hash,
			proposer: r.proposer,
			type: r.type,
			deadline: parseInt(r.deadline as any),
			status: r.status,
			details: r.details,
			created: parseInt(r.created as any),
			txHash: r.txHash,
			deniedAt: r.deniedAt !== null ? parseInt(r.deniedAt as any) : null,
			deniedTxHash: r.deniedTxHash ?? null,
			enactedAt: r.enactedAt !== null ? parseInt(r.enactedAt as any) : null,
			enactedTxHash: r.enactedTxHash ?? null,
		}));
	}

	async updateChains() {
		this.logger.debug('Updating CCIP chains');

		const response = await PONDER_CLIENT.query<{
			cCIPAdminChains: { items: CCIPAdminChainQuery[] };
		}>({
			fetchPolicy: 'no-cache',
			query: gql`
				query {
					cCIPAdminChains(limit: 1000) {
						items {
							chainId
							remoteChainSelector
							active
							remoteTokenAddress
							outboundEnabled
							outboundCapacity
							outboundRate
							inboundEnabled
							inboundCapacity
							inboundRate
							rateLimitUpdatedAt
							rateLimitTxHash
						}
					}
				}
			`,
		});

		if (!response.data?.cCIPAdminChains?.items) {
			this.logger.warn('No cCIPAdminChains data found.');
			return;
		}

		this.fetchedChains = response.data.cCIPAdminChains.items.map((r) => ({
			...r,
			rateLimitUpdatedAt: r.rateLimitUpdatedAt !== null ? parseInt(r.rateLimitUpdatedAt as any) : null,
		}));
	}
}
