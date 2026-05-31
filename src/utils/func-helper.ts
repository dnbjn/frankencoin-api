import { ADDRESS, ChainId, ChainMain, SupportedChains } from '@frankencoin/zchf';
import { mainnet, Chain } from 'viem/chains';
import chains from 'viem/chains';

export function ExplorerAddressUrl(address: string, chain: Chain = mainnet): string {
	return chain.blockExplorers.default.url + `/address/${address}`;
}

export function ExplorerTxUrl(tx: string, chain: Chain = mainnet): string {
	return chain.blockExplorers.default.url + `/tx/${tx}`;
}

export function AppUrl(path: string, chain: Chain = mainnet): string {
	return `${chain.id == 1 ? 'https://zchf.app' : 'https://test.zchf.app'}${path}`;
}

export const getChain = (id: ChainId | number): Chain => {
	for (const chain of Object.values(SupportedChains)) {
		try {
			if ((chain as Chain).id === id) return chain as Chain;
		} catch {
			continue;
		}
	}
	for (const chain of Object.values(chains)) {
		try {
			if ((chain as any as Chain).id === id) return chain as any as Chain;
		} catch {
			continue;
		}
	}
	return ChainMain as any as Chain;
};

export const getChainByName = (name: string): Chain => {
	for (const chain of Object.values(SupportedChains)) {
		try {
			if ((chain as Chain).name.toLowerCase() === name.toLowerCase()) return chain as Chain;
		} catch {
			continue;
		}
	}
	for (const chain of Object.values(chains)) {
		try {
			if ((chain as any as Chain).name.toLowerCase() === name.toLowerCase()) return chain as any as Chain;
		} catch {
			continue;
		}
	}
	return ChainMain as any as Chain;
};

export const getChainByChainSelector = (selector: string | bigint) => {
	const keys = Object.keys(ADDRESS);
	const chainId = keys.find((v) => ADDRESS[Number(v) as ChainId].chainSelector == selector);
	return getChain(Number(chainId) as ChainId);
};
