import { ApiCCIPProposal } from 'modules/bridge/bridge.types';
import { escapeMd, shortenString } from 'utils/format';
import { AppUrl, ExplorerAddressUrl, ExplorerTxUrl, getChain } from 'utils/func-helper';
import { ChainId } from '@frankencoin/zchf';
import { Chain } from 'viem';

const typeLabel: Record<string, string> = {
	AddChain: '🔗 Add Chain',
	RemotePoolUpdate: '🔄 Remote Pool Update',
	RemoveChain: '🗑 Remove Chain',
	AdminTransfer: '👤 Admin Transfer',
};

export function CCIPProposalDeniedMessage(proposal: ApiCCIPProposal): string {
	const chain = getChain(proposal.chainId as ChainId) as Chain;

	return `🚫 *CCIP Proposal Denied*

🌐 Chain: *${chain?.name}* (${proposal.chainId})
📋 Type: *${escapeMd(typeLabel[proposal.type] ?? proposal.type ?? '')}*
👤 Proposer: \`${proposal.proposer ?? 'unknown'}\`
🔑 Hash: \`${shortenString(proposal.hash)}\`

${proposal.deniedTxHash ? `[🔍 Transaction](${ExplorerTxUrl(proposal.deniedTxHash, chain)})` : ''}${proposal.proposer ? ` · [👤 Proposer](${ExplorerAddressUrl(proposal.proposer, chain)})` : ''} · [🏛️ Governance](${AppUrl('/governance', chain)})`;
}
