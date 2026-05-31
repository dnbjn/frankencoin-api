import { ApiCCIPProposal } from 'modules/bridge/bridge.types';
import { escapeMd, shortenString } from 'utils/format';
import { AppUrl, ExplorerAddressUrl, ExplorerTxUrl, getChain } from 'utils/func-helper';
import { ChainId } from '@frankencoin/zchf';
import { Chain } from 'viem';

export function CCIPProposalMessage(proposal: ApiCCIPProposal): string {
	const deadline = new Date(Number(proposal.deadline) * 1000);
	const chain = getChain(proposal.chainId as ChainId) as Chain;
	const details = parseDetails(proposal.type, proposal.details);

	const typeLabel: Record<string, string> = {
		AddChain: '🔗 Add Chain',
		RemotePoolUpdate: '🔄 Remote Pool Update',
		RemoveChain: '🗑 Remove Chain',
		AdminTransfer: '👤 Admin Transfer',
	};

	return `⚠️ *New CCIP Proposal*

🌐 Chain: *${chain?.name}* (${proposal.chainId})
📋 Type: *${escapeMd(typeLabel[proposal.type] ?? proposal.type ?? '')}*
👤 Proposer: \`${proposal.proposer ?? 'unknown'}\`
⏰ Veto Until: *${deadline.toUTCString()}*
${details}
🔑 Hash: \`${shortenString(proposal.hash)}\`

[🔍 Transaction](${ExplorerTxUrl(proposal.txHash, chain)})${proposal.proposer ? ` · [👤 Proposer](${ExplorerAddressUrl(proposal.proposer, chain)})` : ''} · [🏛️ Governance](${AppUrl('/governance', chain)})`;
}

function parseDetails(type: string | null, raw: string | null): string {
	if (!raw) return '';
	try {
		const d = JSON.parse(raw);
		if (type === 'AddChain') {
			return `🔗 Remote Chain: \`${d.remoteChainSelector}\`\n📍 Token: \`${d.remoteTokenAddress ?? '?'}\``;
		}
		if (type === 'RemotePoolUpdate') {
			const action = d.add ? '➕ Add pool' : '➖ Remove pool';
			return `${action} on chain \`${d.chain}\`\n📍 Pool: \`${d.poolAddress ?? '?'}\``;
		}
		if (type === 'RemoveChain') {
			return `🔗 Remote Chain: \`${d.chain}\``;
		}
		if (type === 'AdminTransfer') {
			return `👤 New Admin: \`${d.newAdmin ?? '?'}\``;
		}
	} catch {}
	return '';
}
