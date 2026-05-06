import { ADDRESS, ChainId, ChainMain, SupportedChains } from '@frankencoin/zchf';
import { mainnet, Chain } from 'viem/chains';

export function ExplorerAddressUrl(address: string, chain: Chain = mainnet): string {
	return chain.blockExplorers.default.url + `/address/${address}`;
}

export function ExplorerTxUrl(tx: string, chain: Chain = mainnet): string {
	return chain.blockExplorers.default.url + `/tx/${tx}`;
}

export function AppUrl(path: string, chain: Chain = mainnet): string {
	return `${chain.id == 1 ? 'https://zchf.app' : 'https://test.zchf.app'}${path}`;
}

export const getChain = (id: ChainId) => {
	return Object.values(SupportedChains).find((c) => c.id == id) ?? ChainMain;
};

export const getChainByName = (name: string) => {
	return Object.values(SupportedChains).find((c) => c.name.toLowerCase() == name.toLowerCase()) ?? ChainMain;
};

export const getChainByChainSelector = (selector: string | bigint) => {
	const keys = Object.keys(ADDRESS);
	const chainId = keys.find((v) => ADDRESS[Number(v) as ChainId].chainSelector == selector);
	return getChain(Number(chainId) as ChainId);
};
