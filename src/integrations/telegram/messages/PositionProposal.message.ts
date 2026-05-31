import { PositionQuery } from 'modules/positions/positions.types';
import { escapeMd, formatCurrency, shortenString } from 'utils/format';
import { AppUrl, ExplorerAddressUrl } from 'utils/func-helper';
import { formatUnits } from 'viem';

export function PositionProposalMessage(position: PositionQuery): string {
	const bal = formatUnits(BigInt(position.collateralBalance), position.collateralDecimals);
	const min = formatUnits(BigInt(position.minimumCollateral), position.collateralDecimals);
	const price = formatUnits(BigInt(position.price), 36 - position.collateralDecimals);
	const start = new Date(position.start * 1000).toUTCString();
	const expiryDays = Math.floor((position.expiration * 1000 - Date.now()) / 1000 / 60 / 60 / 24);
	const auctionHours = Math.floor(position.challengePeriod / 3600);

	const sym = escapeMd(position.collateralSymbol);
	const name = escapeMd(position.collateralName);

	return `📋 *New Position Proposal*

📅 Start: *${start}*
🏦 Position: \`${shortenString(position.position)}\` (v${position.version})
👤 Owner: \`${shortenString(position.owner)}\`

💎 Collateral: *${name} (${sym})*
   Address: \`${shortenString(position.collateral)}\`
   Balance: *${formatCurrency(bal, 2, 2)} ${sym}*
   Min Balance: *${formatCurrency(min, 2, 2)} ${sym}*
   Liq. Price: *${formatCurrency(price, 2, 2)} ZCHF*

📊 Terms
   Limit: *${formatCurrency(formatUnits(BigInt(position.limitForClones), 18), 2, 2)} ZCHF*
   Interest: *${formatCurrency(position.annualInterestPPM / 10000, 1, 1)}%* APY
   Reserve: *${formatCurrency(position.reserveContribution / 10000, 1, 1)}%*
   Auction: *${auctionHours} hours*
   Expiry: *${expiryDays} days*

[⚔️ Challenge](${AppUrl(`/monitoring/${position.position}/challenge`)}) · [🚫 Veto](${AppUrl(`/governance`)})
[🔍 Position](${ExplorerAddressUrl(position.position)}) · [🔍 Owner](${ExplorerAddressUrl(position.owner)})`;
}
