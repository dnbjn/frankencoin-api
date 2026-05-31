import { ApiCCIPChain } from 'modules/bridge/bridge.types';
import { AppUrl, ExplorerTxUrl, getChain, getChainByChainSelector } from 'utils/func-helper';
import { ChainId } from '@frankencoin/zchf';
import { Chain, formatUnits } from 'viem';

export function CCIPRateLimitMessage(chain: ApiCCIPChain): string {
	const localChain = getChain(chain.chainId as ChainId);
	const localChainName = localChain?.name;
	const remoteChain = getChainByChainSelector(chain.remoteChainSelector);

	const fmt = (wei: string) => parseFloat(formatUnits(BigInt(wei), 18)).toFixed(4);

	const txLink = chain.rateLimitTxHash ? `[🔍 Transaction](${ExplorerTxUrl(chain.rateLimitTxHash, localChain as Chain)}) · ` : '';

	return `⚡ *CCIP Rate Limit Updated*

🌐 Chain: *${localChainName}* (${chain.chainId})
🔗 Remote: *${remoteChain?.name ?? 'unknown'}* (\`${chain.remoteChainSelector}\`)

📤 Outbound: ${chain.outboundEnabled ? `*${fmt(chain.outboundCapacity)} ZCHF* cap · *${fmt(chain.outboundRate)} ZCHF/s*` : 'disabled'}
📥 Inbound: ${chain.inboundEnabled ? `*${fmt(chain.inboundCapacity)} ZCHF* cap · *${fmt(chain.inboundRate)} ZCHF/s*` : 'disabled'}

${txLink}[🏛️ Governance](${AppUrl('/governance', localChain as Chain)})`;
}
