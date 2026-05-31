import { MinterQuery } from 'modules/ecosystem/ecosystem.minter.types';
import { escapeMd, formatCurrency, shortenString } from 'utils/format';
import { AppUrl, ExplorerTxUrl, getChain } from 'utils/func-helper';
import { Chain } from 'viem';

export function MinterProposalMessage(minter: MinterQuery): string {
	const vetoDeadline = new Date((minter.applyDate + minter.applicationPeriod) * 1000);
	const hours = Math.floor(minter.applicationPeriod / 3600);

	return `🏛️ *New Minter Proposal*

👤 Minter: \`${shortenString(minter.minter)}\`
👤 Suggestor: \`${shortenString(minter.suggestor)}\`
💰 Fee: *${formatCurrency(minter.applicationFee / 1e18, 2, 2)} ZCHF*
⏱ Period: *${hours} hours*
⏰ Veto Until: *${vetoDeadline.toUTCString()}*
💬 Message: ${escapeMd(minter.applyMessage || '—')}

[🏛️ Governance](${AppUrl('/governance')}) · [🔍 Explorer](${ExplorerTxUrl(minter.txHash, getChain(minter.chainId) as Chain)})`;
}
