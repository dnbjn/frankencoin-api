import { Injectable, Logger } from '@nestjs/common';
import {
	ApiOwnerValueLocked,
	ApiPriceERC20,
	ApiPriceERC20Mapping,
	ApiPriceListing,
	ApiPriceMapping,
	ApiPriceMarketChart,
	ERC20Info,
	ERC20InfoObjectArray,
	PriceMarketChartObject,
	PriceQueryCurrencies,
	PriceQueryObjectArray,
	PriceSource,
} from './prices.types';
import { PositionsService } from 'modules/positions/positions.service';
import { COINGECKO_CLIENT, CONFIG } from 'app.config';
import { Address, parseUnits } from 'viem';
import { EcosystemFpsService } from 'modules/ecosystem/ecosystem.fps.service';
import { ADDRESS, ChainMain, SupportedChain } from '@frankencoin/zchf';
import { PrismaService } from 'core/database/prisma.service';
import { mainnet } from 'viem/chains';
import { getEndOfYearPrice } from './yearly.service';
import { PriceHistoryQueryObjectArray } from '../../../exports';

interface IHistoryService {
	getHistory(): PriceHistoryQueryObjectArray;
}
import { Cron, CronExpression } from '@nestjs/schedule';
import { ContractBlacklist, ContractWhitelist } from './prices.mgm';
import { getChain } from 'utils/func-helper';
import { normalizeAddress } from 'utils/format';

@Injectable()
export class PricesService {
	private readonly logger = new Logger(this.constructor.name);

	private fetchedPrices: PriceQueryObjectArray = {};
	private fetchedMarketChart: PriceMarketChartObject = { prices: [], market_caps: [], total_volumes: [] };
	private historyService: IHistoryService | null = null;

	registerHistoryService(service: IHistoryService) {
		this.historyService = service;
	}

	constructor(
		private readonly prisma: PrismaService,
		private readonly positionsService: PositionsService,
		private readonly fps: EcosystemFpsService
	) {
		this.readBackupPriceQuery();
		this.updateMarketChart();
	}

	async readBackupPriceQuery() {
		this.logger.log('Reading backup PriceQueryObject from database');

		const data = (await this.prisma.safeExecute(() => this.prisma.priceCache.findMany())) as any[];

		if (data?.length > 0) {
			const prices: PriceQueryObjectArray = {};
			for (const entry of data) {
				if (ContractBlacklist.includes(entry.address)) {
					await this.prisma.priceCache.delete({ where: { address: entry.address } });
					continue;
				}
				prices[entry.address] = entry.data as any;
			}
			this.fetchedPrices = { ...prices };
			this.logger.log(`PriceQueryObject state restored from database (${Object.keys(prices).length} entries)`);
		} else {
			this.logger.warn('No cached price data found in database');
		}
	}

	async writeBackupPriceQuery() {
		await this.prisma.safeExecute(async () => {
			const allEntries = Object.entries(this.fetchedPrices);
			for (const [address, data] of allEntries) {
				await this.prisma.priceCache.upsert({
					where: { address },
					create: { address, data },
					update: { data },
				});
			}
			this.logger.log(`PriceQueryObject backup stored in database (${allEntries.length} entries)`);
		});
	}

	getPrices(): ApiPriceListing {
		return Object.values(this.fetchedPrices);
	}

	getPricesMapping(): ApiPriceMapping {
		return this.fetchedPrices;
	}

	getMint(): ApiPriceERC20 {
		const p = Object.values(this.positionsService.getPositionsList().list)[0];
		if (!p) return null;
		return {
			chainId: ChainMain.mainnet.id,
			address: p.zchf,
			name: p.zchfName,
			symbol: p.zchfSymbol,
			decimals: p.zchfDecimals,
		};
	}

	getFps(): ApiPriceERC20 {
		return {
			chainId: ChainMain.mainnet.id,
			address: ADDRESS[mainnet.id].equity,
			name: 'Frankencoin Pool Share',
			symbol: 'FPS',
			decimals: 18,
		};
	}

	getCollateral(): ApiPriceERC20Mapping {
		const pos = Object.values(this.positionsService.getPositionsList().list);
		const c: ERC20InfoObjectArray = {};

		for (const p of pos) {
			if (ContractBlacklist.includes(normalizeAddress(p.collateral))) continue;
			c[normalizeAddress(p.collateral)] = {
				chainId: ChainMain.mainnet.id,
				address: p.collateral,
				name: p.collateralName,
				symbol: p.collateralSymbol,
				decimals: p.collateralDecimals,
			};
		}

		for (const i of ContractWhitelist) {
			c[normalizeAddress(i.address)] = i;
		}

		return c;
	}

	getMarketChart(): ApiPriceMarketChart {
		return this.fetchedMarketChart;
	}

	async fetchMarketChartCoingecko(): Promise<PriceMarketChartObject | null> {
		const url = `/api/v3/coins/frankencoin/market_chart?vs_currency=chf&days=90`;
		try {
			const res = await COINGECKO_CLIENT(url);
			if (!res.ok) {
				const body = await res.text();
				this.logger.warn(`CoinGecko ${res.status} ${res.statusText}: ${body.slice(0, 200)}`);
				return null;
			}
			const data = await res.json();
			if (data.status) {
				this.logger.debug(data.status?.error_message || 'Error fetching market chart from coingecko');
				return null;
			}
			return data;
		} catch (err) {
			this.logger.warn(`fetchMarketChartCoingecko failed: ${err instanceof Error ? err.message : String(err)}`);
			return null;
		}
	}

	async fetchPriceTheGraph(erc: ERC20Info): Promise<PriceQueryCurrencies | null> {
		const url = `https://gateway.thegraph.com/api/subgraphs/id/6PRcMNb9RCczH7aAnWvbw7pHgPWmziVsYjwgUFBeE3mR`;
		const query = `{
			token(id: "${normalizeAddress(erc.address)}") {
				priceUSD
				priceCHF
			}
		}`;

		try {
			const response = await fetch(url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${CONFIG.theGraphKey}`,
				},
				body: JSON.stringify({ query }),
			});

			const data = await response.json();

			// Handle indexer errors gracefully
			if (data?.errors) {
				const errorMsg = data.errors[0]?.message || 'Unknown error';
				if (errorMsg.includes('bad indexers') || errorMsg.includes('Unavailable')) {
					this.logger.warn(`The Graph indexer unavailable for ${erc.symbol}, skipping...`);
				} else {
					this.logger.debug(`The Graph error for ${erc.symbol}: ${errorMsg}`);
				}
				return null;
			}

			const token = data?.data?.token;
			if (!token?.priceUSD) return null;

			const usd = parseFloat(token.priceUSD);
			const chf = parseFloat(token.priceCHF);
			return chf > 0 ? { usd, chf } : { usd };
		} catch (error) {
			this.logger.error(`Error fetching price from The Graph: ${error}`);
			return null;
		}
	}

	async fetchPriceDefillama(erc: ERC20Info): Promise<PriceQueryCurrencies | null> {
		const chain = getChain(erc.chainId) as SupportedChain;
		const chainName = chain.id === mainnet.id ? 'ethereum' : chain.name;
		const url = `https://coins.llama.fi/prices/current/${chainName}:${normalizeAddress(erc.address)}`;

		try {
			const response = await fetch(url);
			const data = await response.json();
			const coin = data?.coins?.[`${chainName}:${normalizeAddress(erc.address)}`];
			if (!coin?.price) return null;

			return { usd: Number(coin.price) };
		} catch (error) {
			this.logger.error(`Error fetching price from DefiLlama: ${error}`);
			return null;
		}
	}

	async fetchPriceCoingecko(erc: ERC20Info): Promise<PriceQueryCurrencies | null> {
		const url = `/api/v3/simple/token_price/ethereum?contract_addresses=${erc.address}&vs_currencies=usd`;

		// ignore tokens
		switch (normalizeAddress(erc.address)) {
			case normalizeAddress('0x553C7f9C780316FC1D34b8e14ac2465Ab22a090B'): // REALU
			case normalizeAddress('0x2E880962A9609aA3eab4DEF919FE9E917E99073B'): // BOSS
			case normalizeAddress('0x8747a3114Ef7f0eEBd3eB337F745E31dBF81a952'): // DQTS
			case normalizeAddress('0x343324F53CBEEE3Ee6d171f2a20F005964C98047'): // LENDS
				return null;
		}

		try {
			const data = await (await COINGECKO_CLIENT(url)).json();
			if (data.status) {
				this.logger.debug(data.status?.error_message || 'Error fetching price from CoinGecko');
				return null;
			}

			const priceData = Object.values(data)[0] as { usd?: number } | undefined;
			if (!priceData?.usd || priceData.usd === 0) return null;

			return { usd: priceData.usd };
		} catch (error) {
			this.logger.error(`Error fetching price from CoinGecko: ${error}`);
			return null;
		}
	}

	async fetchPriceSources(erc: ERC20Info): Promise<{ price: PriceQueryCurrencies; source: PriceSource } | null> {
		// Priority 1: Custom overwrite (e.g., Frankencoin Pool Share)
		if (normalizeAddress(erc.address) === normalizeAddress(ADDRESS[mainnet.id].equity)) {
			const priceInChf = this.fps.getEcosystemFpsInfo()?.token?.price;
			const zchfAddress = normalizeAddress(ADDRESS[mainnet.id].frankencoin);
			const zchfPrice: number = this.fetchedPrices[zchfAddress]?.price?.usd;
			if (!zchfPrice || !priceInChf) return null;
			return { price: { usd: priceInChf * zchfPrice }, source: 'custom' };
		}

		// Priority: DeFiLlama
		const defillamaPrice = await this.fetchPriceDefillama(erc);
		if (defillamaPrice) return { price: defillamaPrice, source: 'defillama' };

		// Priority: The Graph
		const thegraphPrice = await this.fetchPriceTheGraph(erc);
		if (thegraphPrice) return { price: thegraphPrice, source: 'thegraph' };

		// Priority: CoinGecko
		const coingeckoPrice = await this.fetchPriceCoingecko(erc);
		if (coingeckoPrice) return { price: coingeckoPrice, source: 'coingecko' };

		// No price found from any source
		return null;
	}

	async getOwnerValueLocked(owner: Address): Promise<ApiOwnerValueLocked> {
		owner = normalizeAddress(owner);
		const history = await this.positionsService.getOwnerHistory(owner);

		const years = Object.keys(history).map((i) => Number(i));

		const yearlyValue: {
			[key: number]: string;
		} = {};

		for (const y of years) {
			const positions = history[y];

			let value = 0n;
			for (const pos of positions) {
				const updates = this.positionsService.getMintingUpdatesMapping().map[normalizeAddress(pos)] || [];
				const itemsUntil = updates.filter((i) => i.created * 1000 < new Date(String(y + 1)).getTime());
				const selected = itemsUntil.at(0);
				if (selected != undefined) {
					const isCurrentYear = new Date().getFullYear() == y;
					const c = normalizeAddress(selected.collateral);
					const d = selected.collateralDecimals;
					const s = BigInt(selected.size);

					let p = 0n;

					if (isCurrentYear) {
						const priceCurrent = parseUnits(String(this.fetchedPrices[c].price.chf), 18);
						p = priceCurrent;
					} else {
						const priceHistory = getEndOfYearPrice({
							year: y,
							contract: selected.collateral,
							history: this.historyService?.getHistory(),
						});
						p = priceHistory;
					}

					const v = (s * p) / BigInt(10 ** d);
					value += v;
				}
			}

			yearlyValue[y] = String(value);
		}

		return yearlyValue;
	}

	async updatePrices() {
		this.logger.debug('Updating Prices');

		const fps = this.getFps();
		const m = this.getMint();
		const c = Object.values(this.getCollateral());

		if (!m || c.length == 0) return;
		const a = [fps, m, ...c];

		const pricesQuery: PriceQueryObjectArray = {};
		let pricesQueryNewCount: number = 0;
		let pricesQueryNewCountFailed: number = 0;
		let pricesQueryUpdateCount: number = 0;
		let pricesQueryUpdateCountFailed: number = 0;

		for (const erc of a) {
			const addr = normalizeAddress(erc.address);
			const oldEntry = this.fetchedPrices[addr];

			if (!oldEntry) {
				pricesQueryNewCount += 1;
				this.logger.debug(`Price for ${erc.name} not available, trying to fetch`);
				const result = await this.fetchPriceSources(erc);
				if (result == null) pricesQueryNewCountFailed += 1;

				pricesQuery[addr] = {
					...erc,
					source: result?.source || null,
					timestamp: result === null ? 0 : Date.now(),
					price: result === null ? { usd: 0, chf: 0 } : result.price,
				};
			} else if (oldEntry.timestamp + 300_000 < Date.now()) {
				// needs to update => try to fetch
				pricesQueryUpdateCount += 1;
				this.logger.debug(`Price for ${erc.name} out of date, trying to fetch`);
				const result = await this.fetchPriceSources(erc);

				if (result == null) {
					pricesQueryUpdateCountFailed += 1;
				} else {
					pricesQuery[addr] = {
						...erc,
						...oldEntry,
						source: result.source,
						timestamp: Date.now(),
						price: { ...oldEntry.price, ...result.price },
					};
				}
			}
		}

		const updatesCnt = pricesQueryNewCount + pricesQueryUpdateCount;
		const fromNewStr = `from new ${pricesQueryNewCount - pricesQueryNewCountFailed} / ${pricesQueryNewCount}`;
		const fromUpdateStr = `from update ${pricesQueryUpdateCount - pricesQueryUpdateCountFailed} / ${pricesQueryUpdateCount}`;

		if (updatesCnt > 0) this.logger.log(`Prices merging, ${fromNewStr}, ${fromUpdateStr}`);
		this.fetchedPrices = { ...this.fetchedPrices, ...pricesQuery };

		Object.values(this.fetchedPrices).forEach((i) => {
			if (ContractBlacklist.includes(normalizeAddress(i.address))) {
				delete this.fetchedPrices[normalizeAddress(i.address)];
			}
		});

		if (pricesQueryUpdateCount > pricesQueryUpdateCountFailed || pricesQueryNewCount > pricesQueryNewCountFailed) {
			this.writeBackupPriceQuery();
		}

		// make chf conversion available
		const frankencoin = normalizeAddress(ADDRESS[mainnet.id].frankencoin);
		const zchfPrice = this.fetchedPrices[frankencoin]?.price?.usd;
		for (const addr of Object.keys(this.fetchedPrices)) {
			// break out if zchf price is not available
			if (zchfPrice == undefined) break;

			// calculate chf value for erc token
			if (this.fetchedPrices[addr]?.timestamp > 0) {
				const priceUsd = this.fetchedPrices[addr]?.price?.usd;
				if (priceUsd == undefined) continue;
				const priceChf = Math.floor((priceUsd / zchfPrice) * 10000) / 10000;
				this.fetchedPrices[addr].price.chf = addr === frankencoin ? 1 : priceChf;
			}
		}
	}

	@Cron(CronExpression.EVERY_10_MINUTES)
	async updateMarketChart() {
		this.logger.debug('Updating Market Chart');

		const data = await this.fetchMarketChartCoingecko();
		if (data) this.fetchedMarketChart = data;
	}
}
