import { gql } from '@apollo/client/core';
import { Injectable, Logger } from '@nestjs/common';
import { DataSourceManagerService } from 'core/data-source/data-source.manager.service';
import {
	LeadrateRateQuery,
	LeadrateRateMapping,
	LeadrateProposedQuery,
	LeadrateProposedMapping,
	ApiLeadrateInfo,
	ApiLeadrateRate,
	ApiLeadrateProposed,
} from './savings.leadrate.types';
import { ADDRESS, ChainId } from '@frankencoin/zchf';
import { Address } from 'viem';
import { normalizeAddress } from 'utils/format';
import { base, mainnet } from 'viem/chains';

@Injectable()
export class SavingsLeadrateService {
	private readonly logger = new Logger(this.constructor.name);
	private fetchedRates: LeadrateRateMapping = {} as LeadrateRateMapping;
	private fetchedProposals: LeadrateProposedMapping = {} as LeadrateProposedMapping;

	constructor(private readonly dataSource: DataSourceManagerService) {}

	getRates(): ApiLeadrateRate {
		const chainIds = Object.keys(this.fetchedRates).map((id) => Number(id)) as ChainId[];
		const rate: ApiLeadrateRate['rate'] = {} as ApiLeadrateRate['rate'];

		for (const chain of chainIds) {
			const modules = Object.keys(this.fetchedRates[chain]).map((module) => module as Address);
			for (const module of modules) {
				// make object available
				if (rate[chain] == undefined) rate[chain] = {};

				// set value
				rate[chain][module] = this.fetchedRates[chain][module][0];
			}
		}

		return {
			rate,
			list: this.fetchedRates,
		};
	}

	getProposals(): ApiLeadrateProposed {
		const chainIds = Object.keys(this.fetchedProposals).map((id) => Number(id)) as ChainId[];
		const proposed: ApiLeadrateProposed['proposed'] = {} as ApiLeadrateProposed['proposed'];

		for (const chain of chainIds) {
			const modules = Object.keys(this.fetchedProposals[chain]).map((module) => module as Address);
			for (const module of modules) {
				// make object available
				if (proposed[chain] == undefined) proposed[chain] = {};

				// set value
				proposed[chain][module] = this.fetchedProposals[chain][module][0];
			}
		}

		return {
			proposed,
			list: this.fetchedProposals,
		};
	}

	getInfo(): ApiLeadrateInfo {
		const rate = this.getRates().rate;
		const proposed = this.getProposals().proposed;

		const open: ApiLeadrateInfo['open'] = {} as ApiLeadrateInfo['open'];

		const chainIds = Object.keys(rate).map((id) => Number(id)) as ChainId[];
		for (const chain of chainIds) {
			const modules = Object.keys(rate[chain]).map((module) => module as Address);
			for (const module of modules) {
				// skip if there are no proposed items
				if (proposed?.[chain]?.[module] == undefined) continue;

				const currentRate = rate[chain][module];
				const latestProposed = proposed[chain][module];
				const isProposal = currentRate.approvedRate != latestProposed.nextRate;
				const isPending = latestProposed.nextChange * 1000 >= Date.now();
				const savingsReferral = normalizeAddress(ADDRESS[mainnet.id].savingsReferral);
				const bridgedSavingsBase = normalizeAddress(ADDRESS[base.id].ccipBridgedSavings);
				const sideChainRate = rate[base.id][bridgedSavingsBase];
				const isSynced = savingsReferral != normalizeAddress(module) || currentRate.approvedRate == sideChainRate.approvedRate;

				// validate that it is an unsettled proposal
				if (!isProposal && !isPending && isSynced) continue;

				// make chain available and make entry
				if (open[chain] == undefined) open[chain] = {};
				open[chain][module] = {
					details: latestProposed,
					currentRate: currentRate.approvedRate,
					nextRate: latestProposed.nextRate,
					nextChange: latestProposed.nextChange,
					isProposal,
					isPending,
					isSynced,
				};
			}
		}

		return {
			rate,
			proposed,
			open,
		};
	}

	async updateLeadrateRates() {
		this.logger.debug('Updating leadrate rates');
		const response = await this.dataSource.queryWithFailover<{
			leadrateRateChangeds: {
				items: LeadrateRateQuery[];
			};
		}>({
			query: gql`
				query {
					leadrateRateChangeds(orderBy: "count", orderDirection: "DESC", limit: 1000) {
						items {
							approvedRate
							blockheight
							chainId
							count
							created
							module
							txHash
						}
					}
				}
			`,
			mergeBackupChainItems: {
				rootField: 'leadrateRateChangeds',
				orderBy: 'count',
				orderDirection: 'desc',
				limit: 1000,
			},
		});

		if (!response || !response.leadrateRateChangeds?.items) {
			this.logger.warn('No leadrateRateChangeds data found.');
			return;
		}

		const d = response.leadrateRateChangeds.items;

		const list: LeadrateRateMapping = {} as LeadrateRateMapping;
		for (const r of d) {
			// make object available
			if (list[r.chainId] == undefined) list[r.chainId] = {};
			if (list[r.chainId][r.module] == undefined) list[r.chainId][r.module] = [] as LeadrateRateQuery[];

			// set state and overwrite type conform
			list[r.chainId][r.module].push({
				chainId: r.chainId,
				count: parseInt(r.count as any),
				module: r.module,
				created: parseInt(r.created as any),
				blockheight: parseInt(r.blockheight as any),
				txHash: r.txHash,
				approvedRate: r.approvedRate,
			});
		}

		this.fetchedRates = list;
	}

	async updateLeadrateProposals() {
		this.logger.debug('Updating leadrate proposals');
		const response = await this.dataSource.queryWithFailover<{
			leadRateProposeds: {
				items: LeadrateProposedQuery[];
			};
		}>({
			query: gql`
				query {
					leadRateProposeds(orderBy: "count", orderDirection: "DESC", limit: 1000) {
						items {
							blockheight
							chainId
							count
							created
							module
							nextChange
							nextRate
							proposer
							txHash
						}
					}
				}
			`,
			mergeBackupChainItems: {
				rootField: 'leadRateProposeds',
				orderBy: 'count',
				orderDirection: 'desc',
				limit: 1000,
			},
		});

		if (!response || !response.leadRateProposeds?.items) {
			this.logger.warn('No leadRateProposeds data found.');
			return;
		}

		const d = response.leadRateProposeds.items;

		const list: LeadrateProposedMapping = {} as LeadrateProposedMapping;
		for (const r of d) {
			// make object available
			if (list[r.chainId] == undefined) list[r.chainId] = {};
			if (list[r.chainId][r.module] == undefined) list[r.chainId][r.module] = [] as LeadrateProposedQuery[];

			// set state and overwrite type conform
			list[r.chainId][r.module].push({
				chainId: r.chainId,
				created: parseInt(r.created as any),
				count: parseInt(r.count as any),
				blockheight: parseInt(r.blockheight as any),
				module: r.module,
				txHash: r.txHash,
				proposer: r.proposer,
				nextChange: r.nextChange,
				nextRate: r.nextRate,
			});
		}

		this.fetchedProposals = list;
	}
}
