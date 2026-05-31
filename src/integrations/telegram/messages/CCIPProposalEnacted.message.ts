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

export function CCIPProposalEnactedMessage(proposal: ApiCCIPProposal): string {
	const chain = getChain(proposal.chainId as ChainId) as Chain;

	return `✅ *CCIP Proposal Enacted*

🌐 Chain: *${chain?.name}* (${proposal.chainId})
📋 Type: *${escapeMd(typeLabel[proposal.type] ?? proposal.type ?? '')}*
👤 Proposer: \`${proposal.proposer ?? 'unknown'}\`
🔑 Hash: \`${shortenString(proposal.hash)}\`

${proposal.enactedTxHash ? `[🔍 Transaction](${ExplorerTxUrl(proposal.enactedTxHash, chain)})` : ''}${proposal.proposer ? ` · [👤 Proposer](${ExplorerAddressUrl(proposal.proposer, chain)})` : ''} · [🏛️ Governance](${AppUrl('/governance', chain)})`;
}
