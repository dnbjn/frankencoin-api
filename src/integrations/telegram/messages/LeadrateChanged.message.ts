import { LeadrateRateQuery } from 'modules/savings/savings.leadrate.types';
import { formatCurrency } from 'utils/format';
import { AppUrl, ExplorerTxUrl, getChain } from 'utils/func-helper';

export function LeadrateChangedMessage(rate: LeadrateRateQuery): string {
	const d = new Date(rate.created * 1000);

	return `✅ *Savings Rate Updated*

📈 New Rate: *${formatCurrency(rate.approvedRate / 10_000)}%*
📅 Valid From: *${d.toUTCString()}*

[🏛️ Governance](${AppUrl('/governance')}) · [🔍 Explorer](${ExplorerTxUrl(rate.txHash, getChain(rate.chainId))})`;
}
