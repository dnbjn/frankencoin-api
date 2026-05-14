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

type PriceSourceResult = { price: PriceQueryCurrencies; source: PriceSource };
type PriceSourceResultMapping = Record<Address, PriceSourceResult>;

@Injectable()
export class PricesService {
	private readonly logger = new Logger(this.constructor.name);

	private static readonly FAILED_FETCH_BACKOFF = 30 * 60 * 1000; // 30 min

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
		const result = await this.fetchPricesTheGraph([erc]);
		return result[normalizeAddress(erc.address)]?.price || null;
	}

	async fetchPricesTheGraph(ercs: ERC20Info[]): Promise<PriceSourceResultMapping> {
		if (ercs.length === 0) return {};

		const url = `https://gateway.thegraph.com/api/subgraphs/id/6PRcMNb9RCczH7aAnWvbw7pHgPWmziVsYjwgUFBeE3mR`;
		const ids = ercs.map((erc) => normalizeAddress(erc.address));
		const query = `{
			tokens(where: { id_in: ${JSON.stringify(ids)} }) {
				id
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
					this.logger.warn(`The Graph indexer unavailable for ${ercs.length} token(s), skipping...`);
				} else {
					this.logger.debug(`The Graph error: ${errorMsg}`);
				}
				return {};
			}

			const prices: PriceSourceResultMapping = {};
			for (const token of data?.data?.tokens || []) {
				if (!token?.id || !token?.priceUSD) continue;

				const usd = parseFloat(token.priceUSD);
				const chf = parseFloat(token.priceCHF);
				const addr = normalizeAddress(token.id);
				prices[addr] = {
					price: chf > 0 ? { usd, chf } : { usd },
					source: 'thegraph',
				};
			}
			return prices;
		} catch (error) {
			this.logger.error(`Error fetching price from The Graph: ${error}`);
			return {};
		}
	}

	async fetchPriceDefillama(erc: ERC20Info): Promise<PriceQueryCurrencies | null> {
		const result = await this.fetchPricesDefillama([erc]);
		return result[normalizeAddress(erc.address)]?.price || null;
	}

	async fetchPricesDefillama(ercs: ERC20Info[]): Promise<PriceSourceResultMapping> {
		const coinToAddress: Record<string, Address> = {};
		const coins = ercs.map((erc) => {
			const coin = this.getDefillamaCoinKey(erc);
			coinToAddress[coin] = normalizeAddress(erc.address);
			return coin;
		});
		if (coins.length === 0) return {};

		const url = `https://coins.llama.fi/prices/current/${coins.join(',')}`;

		try {
			const response = await fetch(url);
			const data = await response.json();
			const prices: PriceSourceResultMapping = {};

			for (const [coinKey, coin] of Object.entries(data?.coins || {})) {
				const price = (coin as { price?: number })?.price;
				const addr = coinToAddress[coinKey];
				if (!addr || !price) continue;

				prices[addr] = {
					price: { usd: Number(price) },
					source: 'defillama',
				};
			}

			return prices;
		} catch (error) {
			this.logger.error(`Error fetching price from DefiLlama: ${error}`);
			return {};
		}
	}

	getDefillamaCoinKey(erc: ERC20Info): string {
		const chain = getChain(erc.chainId) as SupportedChain;
		const chainName = chain.id === mainnet.id ? 'ethereum' : chain.name;
		return `${chainName}:${normalizeAddress(erc.address)}`;
	}

	async fetchPriceCoingecko(erc: ERC20Info): Promise<PriceQueryCurrencies | null> {
		const result = await this.fetchPricesCoingecko([erc]);
		return result[normalizeAddress(erc.address)]?.price || null;
	}

	async fetchPricesCoingecko(ercs: ERC20Info[]): Promise<PriceSourceResultMapping> {
		const addresses = ercs.map((erc) => normalizeAddress(erc.address)).filter((address) => !this.isCoingeckoIgnored(address));

		if (addresses.length === 0) return {};

		const url = `/api/v3/simple/token_price/ethereum?contract_addresses=${addresses.join(',')}&vs_currencies=usd`;

		try {
			const data = await (await COINGECKO_CLIENT(url)).json();
			if (data.status) {
				this.logger.debug(data.status?.error_message || 'Error fetching price from CoinGecko');
				return {};
			}

			const prices: PriceSourceResultMapping = {};
			for (const [address, priceData] of Object.entries(data)) {
				const usd = (priceData as { usd?: number })?.usd;
				if (!usd || usd === 0) continue;

				prices[normalizeAddress(address)] = {
					price: { usd },
					source: 'coingecko',
				};
			}

			return prices;
		} catch (error) {
			this.logger.error(`Error fetching price from CoinGecko: ${error}`);
			return {};
		}
	}

	isCoingeckoIgnored(address: Address): boolean {
		switch (normalizeAddress(address)) {
			case normalizeAddress('0x553C7f9C780316FC1D34b8e14ac2465Ab22a090B'): // REALU
			case normalizeAddress('0x2E880962A9609aA3eab4DEF919FE9E917E99073B'): // BOSS
			case normalizeAddress('0x8747a3114Ef7f0eEBd3eB337F745E31dBF81a952'): // DQTS
			case normalizeAddress('0x343324F53CBEEE3Ee6d171f2a20F005964C98047'): // LENDS
				return true;
			default:
				return false;
		}
	}

	async fetchPriceSources(erc: ERC20Info): Promise<PriceSourceResult | null> {
		const result = await this.fetchPriceSourcesBatch([erc]);
		return result[normalizeAddress(erc.address)] || null;
	}

	async fetchPriceSourcesBatch(ercs: ERC20Info[]): Promise<PriceSourceResultMapping> {
		const prices: PriceSourceResultMapping = {};
		const skipFallback = new Set<Address>();

		// Priority 1: Custom overwrite (e.g., Frankencoin Pool Share)
		for (const erc of ercs) {
			const addr = normalizeAddress(erc.address);
			if (addr !== normalizeAddress(ADDRESS[mainnet.id].equity)) continue;
			skipFallback.add(addr);

			const priceInChf = this.fps.getEcosystemFpsInfo()?.token?.price;
			const zchfAddress = normalizeAddress(ADDRESS[mainnet.id].frankencoin);
			const zchfPrice: number = this.fetchedPrices[zchfAddress]?.price?.usd;
			if (!zchfPrice || !priceInChf) continue;

			prices[addr] = {
				price: { usd: priceInChf * zchfPrice },
				source: 'custom',
			};
		}

		const getMissing = () =>
			ercs.filter((erc) => {
				const addr = normalizeAddress(erc.address);
				return prices[addr] == undefined && !skipFallback.has(addr);
			});

		// Priority: DeFiLlama
		Object.assign(prices, await this.fetchPricesDefillama(getMissing()));

		// Priority: The Graph
		Object.assign(prices, await this.fetchPricesTheGraph(getMissing()));

		// Priority: CoinGecko
		Object.assign(prices, await this.fetchPricesCoingecko(getMissing()));

		return prices;
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
		const pricesToFetch: ERC20Info[] = [];
		const priceFetchMode: Record<Address, 'new' | 'update'> = {};
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
				priceFetchMode[addr] = 'new';
				pricesToFetch.push(erc);
			} else if (oldEntry.timestamp > 0) {
				// has a valid price => refresh if older than 5 min
				if (oldEntry.timestamp + 300_000 < Date.now()) {
					pricesQueryUpdateCount += 1;
					this.logger.debug(`Price for ${erc.name} out of date, trying to fetch`);
					priceFetchMode[addr] = 'update';
					pricesToFetch.push(erc);
				}
			} else if ((oldEntry.lastAttempt ?? 0) + PricesService.FAILED_FETCH_BACKOFF < Date.now()) {
				// previous attempt failed (timestamp === 0) => retry only after backoff
				pricesQueryUpdateCount += 1;
				this.logger.debug(`Price for ${erc.name} still unpriced, retrying after backoff`);
				priceFetchMode[addr] = 'update';
				pricesToFetch.push(erc);
			}
		}

		const fetchedSourcePrices = await this.fetchPriceSourcesBatch(pricesToFetch);
		this.logger.debug(
			`Fetched ${Object.keys(fetchedSourcePrices).length}/${pricesToFetch.length} prices: ${Object.entries(fetchedSourcePrices)
				.map(([address, result]) => `${address}=${result.source}:${JSON.stringify(result.price)}`)
				.join(', ')}`
		);

		for (const erc of pricesToFetch) {
			const addr = normalizeAddress(erc.address);
			const result = fetchedSourcePrices[addr] || null;

			if (priceFetchMode[addr] === 'new') {
				if (result == null) pricesQueryNewCountFailed += 1;

				pricesQuery[addr] = {
					...erc,
					source: result?.source || null,
					timestamp: result === null ? 0 : Date.now(),
					lastAttempt: Date.now(),
					price: result === null ? { usd: 0, chf: 0 } : result.price,
				};
			} else if (priceFetchMode[addr] === 'update') {
				const oldEntry = this.fetchedPrices[addr];
				if (result == null) {
					pricesQueryUpdateCountFailed += 1;
					// preserve previous price/timestamp, but bump lastAttempt so the backoff advances
					pricesQuery[addr] = {
						...erc,
						...oldEntry,
						lastAttempt: Date.now(),
					};
				} else {
					pricesQuery[addr] = {
						...erc,
						...oldEntry,
						source: result.source,
						timestamp: Date.now(),
						lastAttempt: Date.now(),
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

		// persist whenever anything was attempted: every fetched entry mutates state
		// (price and/or lastAttempt), so the backoff survives restarts
		if (pricesToFetch.length > 0) {
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

		this.logger.debug(`Fetched prices state: ${JSON.stringify(this.fetchedPrices)}`);
	}

	@Cron(CronExpression.EVERY_HOUR)
	async updateMarketChart() {
		this.logger.debug('Updating Market Chart');

		const data = await this.fetchMarketChartCoingecko();
		if (data) this.fetchedMarketChart = data;
	}
}
