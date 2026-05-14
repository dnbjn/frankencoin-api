import { Address } from 'viem';
import { ChainId } from '@frankencoin/zchf';

// --------------------------------------------------------------------------------
// Service
export type ERC20InfoObjectArray = {
	[key: Address]: ERC20Info;
};

export type ERC20Info = {
	chainId: ChainId;
	address: Address;
	name: string;
	symbol: string;
	decimals: number;
};

// Price source tracking
export type PriceSource = 'custom' | 'defillama' | 'coingecko' | 'thegraph' | null;

// TODO: Implement other currencies
export type PriceQueryCurrencies = {
	usd?: number;
	chf?: number;
	eur?: number;
};

export type PriceQuery = ERC20Info & {
	source?: PriceSource;
	timestamp: number; // last *successful* price time (0 = never priced)
	lastAttempt?: number; // last fetch attempt time (success or failure)
	price: PriceQueryCurrencies;
};

export type PriceQueryObjectArray = {
	[key: Address]: PriceQuery;
};

export type PriceMarketChartObject = {
	prices: [timestamp: number, value: number][];
	market_caps: [timestamp: number, value: number][];
	total_volumes: [timestamp: number, value: number][];
};

export type PriceHistoryQuery = ERC20Info & {
	timestamp: number;
	price: PriceQueryCurrencies;
	history: {
		[key: number]: number;
	};
};

export type PriceHistoryQueryObjectArray = {
	[k in PriceHistoryQuery['address']]: PriceHistoryQuery;
};

export type PriceHistoryRatio = {
	timestamp: number;
	collateralRatioBySupply: {
		[key: number]: number;
	};
	collateralRatioByFreeFloat: {
		[key: number]: number;
	};
};

// --------------------------------------------------------------------------------
// Api
export type ApiPriceListing = PriceQuery[];
export type ApiPriceMapping = PriceQueryObjectArray;
export type ApiPriceERC20 = ERC20Info;
export type ApiPriceERC20Mapping = ERC20InfoObjectArray;

export type ApiOwnerValueLocked = {
	[key: number]: string;
};

export type ApiPriceMarketChart = PriceMarketChartObject;
