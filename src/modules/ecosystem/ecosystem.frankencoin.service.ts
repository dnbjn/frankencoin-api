import { Injectable, Logger } from '@nestjs/common';
import { gql } from '@apollo/client/core';
import { DataSourceManagerService } from 'core/data-source/data-source.manager.service';
import {
	EcosystemQuery,
	EcosystemERC20StatusQuery,
	EcosystemFrankencoinKeyValues,
	EcosystemFrankencoinMapping,
	ApiEcosystemFrankencoinKeyValues,
	ApiEcosystemFrankencoinInfo,
	EcosystemERC20TotalSupply,
	FrankencoinSupplyQueryObject,
	FrankencoinSupplyQuery,
} from './ecosystem.frankencoin.types';
import { PricesService } from 'modules/prices/prices.service';
import { EcosystemFpsService } from './ecosystem.fps.service';
import { EcosystemCollateralService } from './ecosystem.collateral.service';
import { ADDRESS, ChainId, SupportedChainIds, SupportedChains } from '@frankencoin/zchf';
import { formatFloat, normalizeAddress } from 'utils/format';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Address, formatUnits } from 'viem';
import { PrismaService } from 'core/database/prisma.service';

@Injectable()
export class EcosystemFrankencoinService {
	private readonly logger = new Logger(this.constructor.name);
	private ecosystemFrankencoinKeyValues: EcosystemFrankencoinKeyValues;
	private ecosystemFrankencoin: EcosystemFrankencoinMapping = {} as EcosystemFrankencoinMapping;
	private ecosystemTotalSupply: FrankencoinSupplyQueryObject = {} as FrankencoinSupplyQueryObject;
	private supplyFirstRun = true;

	constructor(
		private readonly prisma: PrismaService,
		private readonly fpsService: EcosystemFpsService,
		private readonly collService: EcosystemCollateralService,
		private readonly pricesService: PricesService,
		private readonly dataSource: DataSourceManagerService
	) {
		this.readBackupSupplyQuery();
	}

	async readBackupSupplyQuery() {
		if (!this.prisma.isEnabled()) {
			this.logger.warn('Database disabled, skipping supply query restoration');
			this.updateTotalSupply();
			return;
		}

		this.logger.log(`Reading backup supply query from database`);

		try {
			const records = await this.prisma.ecosystemSupply.findMany({
				orderBy: { updatedAt: 'desc' },
			});

			if (records) {
				for (const i of records) {
					this.ecosystemTotalSupply[String(i.timestamp)] = i.data;
				}
				this.logger.log(`Supply query state restored from database (${records.length} entries)`);
			} else {
				this.logger.warn('No supply data found in database, fetching fresh data');
				this.updateTotalSupply();
			}
		} catch (error) {
			this.logger.error('Failed to read supply data from database', error);
			this.updateTotalSupply();
		}
	}

	async writeBackupSupplyQuery(all = false) {
		if (!this.prisma.isEnabled()) {
			return;
		}

		try {
			const timestamps = all ? Object.keys(this.ecosystemTotalSupply) : Object.keys(this.ecosystemTotalSupply).slice(-3);

			for (const timestamp of timestamps) {
				await this.prisma.ecosystemSupply.upsert({
					where: { timestamp: BigInt(timestamp) },
					create: { timestamp: BigInt(timestamp), data: this.ecosystemTotalSupply[timestamp] as any },
					update: { data: this.ecosystemTotalSupply[timestamp] as any },
				});
			}

			this.logger.log(`Supply query backup stored to database (${timestamps.length} entries)`);
		} catch (error) {
			this.logger.error('Failed to write supply data to database', error);
		}
	}

	getEcosystemFrankencoinKeyValues(): ApiEcosystemFrankencoinKeyValues {
		return this.ecosystemFrankencoinKeyValues;
	}

	getEcosystemFrankencoinInfo(): ApiEcosystemFrankencoinInfo {
		const supply = Object.values(this.ecosystemFrankencoin).reduce((a, b) => {
			return a + b.supply;
		}, 0);

		return {
			erc20: {
				name: 'Frankencoin',
				symbol: 'ZCHF',
				decimals: 18,
			},
			chains: this.ecosystemFrankencoin,
			token: {
				usd: Object.values(this.pricesService.getPrices()).find((p) => p.symbol === 'ZCHF')?.price?.usd || 1,
				supply,
			},
			fps: this.fpsService.getEcosystemFpsInfo()?.token,
			tvl: this.collService.getCollateralStats()?.totalValueLocked ?? {},
		};
	}

	getKeyValueItem(key: string) {
		return this.ecosystemFrankencoinKeyValues?.[key];
	}

	getTotalSupply() {
		return this.ecosystemTotalSupply;
	}

	async updateEcosystemKeyValues() {
		this.logger.debug('Updating EcosystemKeyValues');
		const data = await this.dataSource.queryWithFailover<{
			commonEcosystems: {
				items: EcosystemQuery[];
			};
		}>({
			query: gql`
				query {
					commonEcosystems(orderBy: "id", limit: 1000) {
						items {
							id
							value
							amount
						}
					}
				}
			`,
		});

		if (!data || !data.commonEcosystems.items) {
			this.logger.warn('No commonEcosystems data found.');
			return;
		}

		const d = data.commonEcosystems.items;

		// key values mapping
		const mappingKeyValues: EcosystemFrankencoinKeyValues = {};
		for (const i of d) {
			mappingKeyValues[i.id] = i;
		}

		if (JSON.stringify(mappingKeyValues) !== JSON.stringify(this.ecosystemFrankencoinKeyValues)) {
			this.ecosystemFrankencoinKeyValues = { ...mappingKeyValues };
		}
	}

	async updateEcosystemERC20Status() {
		this.logger.debug('Updating EcosystemERC20Status');
		const data = await this.dataSource.queryWithFailover<{
			eRC20Statuss: {
				items: EcosystemERC20StatusQuery[];
			};
		}>({
			query: gql`
				query {
					eRC20Statuss(orderBy: "updated", orderDirection: "DESC", limit: 1000) {
						items {
							balance
							burn
							chainId
							mint
							supply
							token
							updated
						}
					}
				}
			`,
			mergeBackupChainItems: {
				rootField: 'eRC20Statuss',
				orderBy: 'updated',
				orderDirection: 'desc',
				limit: 1000,
			},
		});

		if (!data || !data.eRC20Statuss.items) {
			this.logger.warn('No eRC20Statuss data found.');
			return;
		}

		const d = data.eRC20Statuss.items;

		// chainId mapping
		const updatedFrankencoin = { ...this.ecosystemFrankencoin };
		for (const i of d) {
			// verify chainId with token address
			if (i.chainId == 1) {
				const a = normalizeAddress(ADDRESS[i.chainId].frankencoin);
				if (a != i.token) continue;
			} else {
				const a = normalizeAddress(ADDRESS[i.chainId].ccipBridgedFrankencoin);
				if (a != i.token) continue;
			}

			updatedFrankencoin[i.chainId as ChainId] = {
				chainId: i.chainId,
				updated: parseInt(i.updated as any),
				address: i.token,
				supply: formatFloat(i.supply),
				counter: {
					mint: formatFloat(i.mint, 0),
					burn: formatFloat(i.burn, 0),
					balance: formatFloat(i.balance, 0),
				},
			};
		}

		if (JSON.stringify(updatedFrankencoin) !== JSON.stringify(this.ecosystemFrankencoin)) {
			this.ecosystemFrankencoin = updatedFrankencoin;
		}
	}

	@Cron(CronExpression.EVERY_10_MINUTES)
	async updateTotalSupply() {
		this.logger.debug('Updating updateTotalSupply');
		const all = this.supplyFirstRun;
		if (all) this.logger.log('Supply first run — rewriting all timestamps from Ponder');

		// Deep copy to avoid mutating live state through shared object references
		const returnData: FrankencoinSupplyQueryObject = JSON.parse(JSON.stringify(this.ecosystemTotalSupply));

		for (const chain of Object.values(SupportedChains)) {
			const chainId = chain.id;
			let frankencoin: Address;

			if (chainId == 1) {
				frankencoin = ADDRESS[chainId].frankencoin;
			} else {
				frankencoin = ADDRESS[chainId].ccipBridgedFrankencoin;
			}

			// Paginate through all events — Ponder caps at 1000 per request
			let after: string | null = null;
			let hasNextPage = true;
			const allItems: EcosystemERC20TotalSupply[] = [];

			while (hasNextPage) {
				const afterArg = after ? `, after: "${after}"` : '';
				const pageData = await this.dataSource.queryWithFailover<{
					eRC20TotalSupplys: {
						items: EcosystemERC20TotalSupply[];
						pageInfo: { endCursor: string; hasNextPage: boolean };
					};
				}>({
					query: gql`
					query {
						eRC20TotalSupplys(
							orderBy: "created"
							orderDirection: "asc"
							where: { chainId: ${chainId}, token: "${frankencoin}" }
							limit: 1000
							${afterArg}
						) {
							items {
								supply
								created
							}
							pageInfo {
								endCursor
								hasNextPage
							}
						}
					}
				`,
					chainId,
				});

				if (!pageData || !pageData.eRC20TotalSupplys.items) {
					this.logger.warn(`No eRC20TotalSupplys data (chain: ${chain.name}) found.`);
					break;
				}

				const page = pageData.eRC20TotalSupplys;
				allItems.push(...page.items);
				hasNextPage = page.pageInfo.hasNextPage;
				after = page.pageInfo.endCursor;
			}

			if (allItems.length === 0) continue;

			this.logger.debug(`Chain ${chain.name}: fetched ${allItems.length} supply events`);

			// On first run after startup (all=true) rewrite every timestamp so a fresh
			// Ponder re-index is fully reflected without needing a manual DB wipe.
			// On subsequent runs only add new timestamps or update the last 7 days,
			// preventing sparse Ponder checkpoints from corrupting accumulated history.
			const recentCutoff = Math.floor(Date.now() / 1000) - 7 * 86400;

			allItems.forEach((i) => {
				const ts = Number(i.created);
				const supplyValue = parseFloat(formatUnits(i.supply, 18));

				if (returnData[i.created] == undefined) {
					// New timestamp — always add it
					returnData[i.created] = {
						created: i.created,
						supply: 0,
						allocation: { [chainId]: supplyValue } as FrankencoinSupplyQuery['allocation'],
					};
				} else if (all || ts >= recentCutoff) {
					// First run or recent entry — overwrite with Ponder data
					const alloc = returnData[i.created]['allocation'];
					returnData[i.created]['allocation'] = { ...alloc, [chainId]: supplyValue };
				}
				// Historical entry on a normal run → skip to protect accumulated history
			});
		}

		const timestampKeys = Object.keys(returnData);

		for (let i = 0; i < timestampKeys.length; i++) {
			let prev: FrankencoinSupplyQuery['allocation'] = {} as FrankencoinSupplyQuery['allocation'];
			if (i == 0) {
				SupportedChainIds.forEach((id) => {
					prev[id] = 0;
				});
			} else {
				prev = returnData[timestampKeys[i - 1]].allocation;
			}

			const created = parseInt(timestampKeys[i]) as FrankencoinSupplyQuery['created'];
			const data = returnData[created];

			const alloc = {
				...prev,
				...data.allocation,
			};

			const supply = Object.values(alloc).reduce((a, b) => a + b, 0);

			returnData[created] = {
				created,
				supply,
				allocation: {
					...alloc,
				},
			};
		}

		const snapshotBefore = JSON.stringify(this.ecosystemTotalSupply);
		this.ecosystemTotalSupply = { ...returnData };
		const snapshotAfter = JSON.stringify(this.ecosystemTotalSupply);

		if (snapshotAfter != snapshotBefore) this.writeBackupSupplyQuery(all);

		this.supplyFirstRun = false;
	}
}
