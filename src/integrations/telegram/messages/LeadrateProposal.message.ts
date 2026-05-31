import { LeadrateProposedQuery, LeadrateRateQuery } from 'modules/savings/savings.leadrate.types';
import { formatCurrency, shortenString } from 'utils/format';
import { AppUrl, ExplorerTxUrl, getChain } from 'utils/func-helper';

export function LeadrateProposalMessage(proposal: LeadrateProposedQuery, rates: LeadrateRateQuery[]): string {
	const deadline = new Date(proposal.nextChange * 1000);
	const currentRate = rates.find((r) => r.module === proposal.module)?.approvedRate;
	const isUnchanged = currentRate === proposal.nextRate;

	return `📊 *New Leadrate Proposal*

📅 Valid Until: *${deadline.toUTCString()}*
👤 Proposer: \`${shortenString(proposal.proposer)}\`

📈 Current Rate: *${formatCurrency(currentRate / 10000)}%*
📈 Proposed Rate: *${formatCurrency(proposal.nextRate / 10000)}%*

${isUnchanged ? '*Rate will remain unchanged*' : '*Rate can be applied after 7 days*'}

[🏛️ Governance](${AppUrl('/governance')}) · [🔍 Explorer](${ExplorerTxUrl(proposal.txHash, getChain(proposal.chainId))})`;
}
