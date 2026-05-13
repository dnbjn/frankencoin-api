import { gql } from '@apollo/client/core';
import { Injectable, Logger } from '@nestjs/common';
import { EcosystemFrankencoinService } from 'modules/ecosystem/ecosystem.frankencoin.service';
import {
	ApiSavingsActivity,
	ApiSavingsBalance,
	ApiSavingsInfo,
	ApiSavingsRanked,
	SavingsActivityQuery,
	SavingsBalance,
	SavingsBalanceChainIdMapping,
	SavingsBalanceQuery,
	SavingsStatusMapping,
	SavingsStatusQuery,
} from './savings.core.types';
import { DataSourceManagerService } from 'core/data-source/data-source.manager.service';
import { formatFloat } from 'utils/format';
import { Address } from 'viem';

@Injectable()
export class SavingsCoreService {
	private readonly logger = new Logger(this.constructor.name);
	private fetchedStatus: SavingsStatusMapping = {} as SavingsStatusMapping;
	private fetchedRanked: SavingsBalance[] = [];

	constructor(
		private readonly fc: EcosystemFrankencoinService,
		private readonly dataSource: DataSourceManagerService
	) {}

	getInfo(): ApiSavingsInfo {
		const totalBalance = Object.values(this.fetchedStatus).reduce((a, b) => {
			const modules = Object.values(b).reduce((a, b) => a + formatFloat(BigInt(b.balance)), 0);
			return a + modules;
		}, 0);
		const totalInterest = Object.values(this.fetchedStatus).reduce((a, b) => {
			const modules = Object.values(b).reduce((a, b) => a + formatFloat(BigInt(b.interest)), 0);
			return a + modules;
		}, 0);

		const totalSupply = this.fc.getEcosystemFrankencoinInfo().token.supply;
		const ratioOfSupply: number = totalBalance / totalSupply;

		return {
			status: this.fetchedStatus,
			totalBalance,
			ratioOfSupply,
			totalInterest,
		};
	}

	getRanked(): ApiSavingsRanked {
		return this.fetchedRanked;
	}

	async getBalance(account: Address): Promise<ApiSavingsBalance> {
		this.logger.debug('getting getBalance');
		const response = await this.dataSource.queryWithFailover<{
			savingsMappings: {
				items: SavingsBalanceQuery[];
			};
		}>({
			query: gql`
				query {
					savingsMappings(where: { balance_gt: "0", account: "${account}" }, orderBy: "balance", orderDirection: "DESC", limit: 1000) {
						items {
							account
							balance
							chainId
							counterInterest
							counterSave
							counterWithdraw
							created
							interest
							module
							save
							updated
							withdraw
						}
					}
				}
			`,
			mergeBackupChainItems: {
				rootField: 'savingsMappings',
				orderBy: 'balance',
				orderDirection: 'desc',
				limit: 1000,
			},
		});

		if (!response || !response.savingsMappings?.items) {
			this.logger.warn('No savingsMappings data found.');
			return {} as ApiSavingsBalance;
		}

		const data = response.savingsMappings.items;

		const list: SavingsBalanceChainIdMapping = {} as SavingsBalanceChainIdMapping;
		for (const r of data) {
			// make object available, chainId -> balance
			if (list[r.chainId] == undefined) list[r.chainId] = {};

			// set state and overwrite type conform
			const data: SavingsBalance = {
				chainId: r.chainId,
				account: r.account,
				module: r.module,
				balance: r.balance,
				created: parseInt(r.created as any),
				updated: parseInt(r.updated as any),
				save: r.save,
				interest: r.interest,
				withdraw: r.withdraw,
				counter: {
					save: parseInt(r.counterSave as any),
					interest: parseInt(r.counterInterest as any),
					withdraw: parseInt(r.counterWithdraw as any),
				},
			};

			list[r.chainId][r.module] = data;
		}

		return list;
	}

	async getActivity(account: Address): Promise<ApiSavingsActivity> {
		this.logger.debug('getting getActivity');
		const response = await this.dataSource.queryWithFailover<{
			savingsActivitys: {
				items: SavingsActivityQuery[];
			};
		}>({
			query: gql`
				query {
					savingsActivitys(where: { account: "${account}" }, orderBy: "created", orderDirection: "DESC", limit: 1000) {
						items {
							account
							amount
							balance
							blockheight
							chainId
							count
							created
							interest
							kind
							module
							rate
							save
							txHash
							withdraw
						}
					}
				}
			`,
			mergeBackupChainItems: {
				rootField: 'savingsActivitys',
				orderBy: 'created',
				orderDirection: 'desc',
				limit: 1000,
			},
		});

		if (!response || !response.savingsActivitys?.items) {
			this.logger.warn('No savingsActivitys data found.');
			return {} as ApiSavingsActivity;
		}

		const data = response.savingsActivitys.items;

		const list: SavingsActivityQuery[] = [];
		for (const r of data) {
			// set state and overwrite type conform
			list.push({
				chainId: r.chainId,
				account: r.account,
				module: r.module,
				created: parseInt(r.created as any),
				blockheight: parseInt(r.blockheight as any),
				count: parseInt(r.count as any),
				balance: r.balance,
				save: r.save,
				interest: r.interest,
				withdraw: r.withdraw,
				kind: r.kind,
				amount: r.amount,
				rate: r.rate,
				txHash: r.txHash,
			});
		}

		return list;
	}

	async updateSavingsStatus() {
		this.logger.debug('Updating savings status');
		const response = await this.dataSource.queryWithFailover<{
			savingsStatuss: {
				items: SavingsStatusQuery[];
			};
		}>({
			query: gql`
				query {
					savingsStatuss(orderBy: "updated", orderDirection: "DESC", limit: 1000) {
						items {
							balance
							chainId
							counterInterest
							counterRateChanged
							counterRateProposed
							counterSave
							counterWithdraw
							interest
							module
							rate
							save
							updated
							withdraw
						}
					}
				}
			`,
			mergeBackupChainItems: {
				rootField: 'savingsStatuss',
				orderBy: 'updated',
				orderDirection: 'desc',
				limit: 1000,
			},
		});

		if (!response || !response.savingsStatuss?.items) {
			this.logger.warn('No savingsStatuss data found.');
			return;
		}

		const d = response.savingsStatuss.items;

		const list: SavingsStatusMapping = {} as SavingsStatusMapping;
		for (const r of d) {
			// make object available
			if (list[r.chainId] == undefined) list[r.chainId] = {};

			// set state and overwrite type conform
			list[r.chainId][r.module] = {
				chainId: r.chainId,
				updated: parseInt(r.updated as any),
				module: r.module,
				balance: r.balance,
				interest: r.interest,
				save: r.save,
				withdraw: r.withdraw,
				rate: r.rate,
				counter: {
					interest: parseInt(r.counterInterest as any),
					rateChanged: parseInt(r.counterRateChanged as any),
					rateProposed: parseInt(r.counterRateProposed as any),
					save: parseInt(r.counterSave as any),
					withdraw: parseInt(r.counterWithdraw as any),
				},
			};
		}

		this.fetchedStatus = list;
	}

	async updateSavingsRank() {
		this.logger.debug('Updating updateSavingsRank');
		const response = await this.dataSource.queryWithFailover<{
			savingsMappings: {
				items: SavingsBalanceQuery[];
			};
		}>({
			query: gql`
				query {
					savingsMappings(where: { balance_gt: "0" }, orderBy: "balance", orderDirection: "DESC", limit: 20) {
						items {
							account
							balance
							chainId
							counterInterest
							counterSave
							counterWithdraw
							created
							interest
							module
							save
							updated
							withdraw
						}
					}
				}
			`,
			mergeBackupChainItems: {
				rootField: 'savingsMappings',
				orderBy: 'balance',
				orderDirection: 'desc',
				limit: 20,
			},
		});

		if (!response || !response.savingsMappings?.items) {
			this.logger.warn('No savingsMappings data found.');
			return;
		}

		const d = response.savingsMappings.items;

		const ranked: SavingsBalance[] = [];
		for (const r of d) {
			// set state and overwrite type conform
			const data: SavingsBalance = {
				chainId: r.chainId,
				account: r.account,
				module: r.module,
				balance: r.balance,
				created: parseInt(r.created as any),
				updated: parseInt(r.updated as any),
				save: r.save,
				interest: r.interest,
				withdraw: r.withdraw,
				counter: {
					save: parseInt(r.counterSave as any),
					interest: parseInt(r.counterInterest as any),
					withdraw: parseInt(r.counterWithdraw as any),
				},
			};

			ranked.push(data);
		}

		this.fetchedRanked = ranked;
	}
}
