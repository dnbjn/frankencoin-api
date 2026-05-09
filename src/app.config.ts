import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client/core';
import { setContext } from '@apollo/client/link/context';
import { http, createPublicClient, PublicClient } from 'viem';
import { SupportedChainIds, ChainId } from '@frankencoin/zchf';
import { arbitrum, avalanche, base, gnosis, mainnet, optimism, polygon, sonic } from 'viem/chains';

import * as dotenv from 'dotenv';
dotenv.config();

// Verify environment
if (process.env.ALCHEMY_RPC_KEY === undefined) throw new Error('ALCHEMY_RPC_KEY not available');
if (process.env.COINGECKO_API_KEY === undefined) throw new Error('COINGECKO_API_KEY not available');
if (process.env.THE_GRAPH_KEY === undefined) throw new Error('THE_GRAPH_KEY not available');

// Config type
export type ConfigType = {
	app: string;
	indexer: string;
	backupIndexer: string | null;
	coingeckoApiKey: string;
	alchemyRpcKey: string;
	theGraphKey: string;
	supportedChainIds: ChainId[];
	databaseEnabled: boolean;
};

// Create config
export const CONFIG: ConfigType = {
	app: process.env.CONFIG_APP_URL || 'https://zchf.app',
	indexer: process.env.CONFIG_INDEXER_URL || 'https://ponder.zchf.app',
	backupIndexer: process.env.CONFIG_BACKUP_INDEXER_URL || null,
	coingeckoApiKey: process.env.COINGECKO_API_KEY,
	alchemyRpcKey: process.env.ALCHEMY_RPC_KEY,
	theGraphKey: process.env.THE_GRAPH_KEY,
	supportedChainIds: SupportedChainIds,
	databaseEnabled: process.env.DISABLE_DATABASE !== 'true',
};

// Headers required to pass through Cloudflare Access in front of the indexer.
// Reads directly from process.env on every call so it always reflects the current
// runtime environment, not whatever CONFIG captured at module load.
export const ponderAccessHeaders = (): Record<string, string> => {
	const id = process.env.CF_ACCESS_CLIENT_ID;
	const secret = process.env.CF_ACCESS_CLIENT_SECRET;
	return id && secret
		? {
			'CF-Access-Client-Id': id,
			'CF-Access-Client-Secret': secret,
		}
		: {};
};

// Validate the CF-Access pair at module load. Misconfiguration is silent at request time
// (returns {} → primary 403s → all traffic falls to backup), so surface it loudly here.
// We warn rather than throw because forks/local dev may legitimately not gate the indexer.
{
	const id = process.env.CF_ACCESS_CLIENT_ID;
	const secret = process.env.CF_ACCESS_CLIENT_SECRET;
	if ((id && !secret) || (!id && secret)) {
		// eslint-disable-next-line no-console
		console.warn(
			'[CF-Access] Incomplete pair: only one of CF_ACCESS_CLIENT_ID / CF_ACCESS_CLIENT_SECRET is set. ' +
				'Primary indexer will be rejected at Cloudflare Access. Set both, or unset both.'
		);
	} else if (!id && !secret) {
		// eslint-disable-next-line no-console
		console.warn(
			'[CF-Access] CF_ACCESS_CLIENT_ID / CF_ACCESS_CLIENT_SECRET not set. ' +
				`If primary indexer (${CONFIG.indexer}) sits behind Cloudflare Access, all primary requests will 403.`
		);
	}
}

// PONDER CLIENT REQUEST (Primary Indexer) — Cloudflare Access in front, inject service token via setContext
const ponderAuthLink = setContext((_, { headers }) => ({
	headers: { ...headers, ...ponderAccessHeaders() },
}));
const ponderHttpLink = createHttpLink({ uri: CONFIG.indexer });

export const PONDER_CLIENT = new ApolloClient({
	link: ponderAuthLink.concat(ponderHttpLink),
	cache: new InMemoryCache(),
});

// PONDER CLIENT BACKUP (Backup Indexer) — not behind Cloudflare Access, no auth headers
export const PONDER_CLIENT_BACKUP = CONFIG.backupIndexer
	? new ApolloClient({
		uri: CONFIG.backupIndexer,
		cache: new InMemoryCache(),
	})
	: null;

// VIEM CONFIG BY CHAINS
export const ViemConfigMainnet = createPublicClient({
	chain: mainnet,
	transport: http(`https://eth-mainnet.g.alchemy.com/v2/${CONFIG.alchemyRpcKey}`),
	batch: {
		multicall: {
			wait: 200,
		},
	},
});

export const ViemConfigPolygon = createPublicClient({
	chain: polygon,
	transport: http(`https://polygon-mainnet.g.alchemy.com/v2/${CONFIG.alchemyRpcKey}`),
	batch: {
		multicall: {
			wait: 200,
		},
	},
});

export const ViemConfigOptimism = createPublicClient({
	chain: optimism,
	transport: http(`https://opt-mainnet.g.alchemy.com/v2/${CONFIG.alchemyRpcKey}`),
	batch: {
		multicall: {
			wait: 200,
		},
	},
});

export const ViemConfigArbitrum = createPublicClient({
	chain: arbitrum,
	transport: http(`https://arb-mainnet.g.alchemy.com/v2/${CONFIG.alchemyRpcKey}`),
	batch: {
		multicall: {
			wait: 200,
		},
	},
});

export const ViemConfigBase = createPublicClient({
	chain: base,
	transport: http(`https://base-mainnet.g.alchemy.com/v2/${CONFIG.alchemyRpcKey}`),
	batch: {
		multicall: {
			wait: 200,
		},
	},
});

export const ViemConfigAvalanche = createPublicClient({
	chain: avalanche,
	transport: http(`https://avax-mainnet.g.alchemy.com/v2/${CONFIG.alchemyRpcKey}`),
	batch: {
		multicall: {
			wait: 200,
		},
	},
});

export const ViemConfigGnosis = createPublicClient({
	chain: gnosis,
	transport: http(`https://gnosis-mainnet.g.alchemy.com/v2/${CONFIG.alchemyRpcKey}`),
	batch: {
		multicall: {
			wait: 200,
		},
	},
});

export const ViemConfigSonic = createPublicClient({
	chain: sonic,
	transport: http(`https://sonic-mainnet.g.alchemy.com/v2/${CONFIG.alchemyRpcKey}`),
	batch: {
		multicall: {
			wait: 200,
		},
	},
});

// VIEM CONFIG MERGED
// @dev: The inferred type of this node exceeds the maximum length the compiler will serialize. An explicit type annotation is needed.
export const VIEM_CONFIG: Record<number, PublicClient> = {
	[mainnet.id]: ViemConfigMainnet as PublicClient,
	[polygon.id]: ViemConfigPolygon as PublicClient,
	[optimism.id]: ViemConfigOptimism as PublicClient,
	[arbitrum.id]: ViemConfigArbitrum as PublicClient,
	[base.id]: ViemConfigBase as PublicClient,
	[avalanche.id]: ViemConfigAvalanche as PublicClient,
	[gnosis.id]: ViemConfigGnosis as PublicClient,
	[sonic.id]: ViemConfigSonic as PublicClient,
} as const;

// COINGECKO CLIENT
export const COINGECKO_CLIENT = (query: string) => {
	const uri: string = `https://api.coingecko.com${query}`;
	return fetch(uri, {
		headers: {
			accept: 'application/json',
			'x-cg-demo-api-key': CONFIG.coingeckoApiKey,
		},
	});
};
