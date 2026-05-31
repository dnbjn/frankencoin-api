import { PositionQuery } from 'modules/positions/positions.types';
import { escapeMd, formatCurrency, shortenString } from 'utils/format';
import { AppUrl, ExplorerAddressUrl } from 'utils/func-helper';
import { formatUnits } from 'viem';

export function PositionExpiringSoonMessage(position: PositionQuery): string {
	const bal = parseInt(formatUnits(BigInt(position.collateralBalance), position.collateralDecimals - 2)) / 100;
	const min = parseInt(formatUnits(BigInt(position.minimumCollateral), position.collateralDecimals - 2)) / 100;
	const price = parseInt(formatUnits(BigInt(position.price), 36 - position.collateralDecimals - 2)) / 100;
	const expiryDate = new Date(position.expiration * 1000);
	const expiryDays = formatCurrency((position.expiration * 1000 - Date.now()) / 1000 / 60 / 60 / 24);
	const auctionHours = Math.floor(position.challengePeriod / 3600);

	const sym = escapeMd(position.collateralSymbol);
	const name = escapeMd(position.collateralName);

	return `⏰ *Position Expiring Soon*

🏦 Position: \`${shortenString(position.position)}\` (v${position.version})
👤 Owner: \`${shortenString(position.owner)}\`

📅 Expiry: *${expiryDate.toUTCString()}* (in *${expiryDays} days*)
⏱ Auction Duration: *${auctionHours} hours*

💎 Collateral: *${name} (${sym})*
   Address: \`${shortenString(position.collateral)}\`
   Balance: *${formatCurrency(bal, 2, 2)} ${sym}* (min *${formatCurrency(min, 2, 2)}*)
   Liq. Price: *${formatCurrency(price, 2, 2)} ZCHF*

💵 Minted: *${formatCurrency(formatUnits(BigInt(position.minted), 18), 2, 2)} ZCHF*
   Reserve: *${formatCurrency(position.reserveContribution / 10000, 1, 1)}%*

[📋 Overview](${AppUrl(`/monitoring/${position.position}`)})
[🔍 Position](${ExplorerAddressUrl(position.position)}) · [🔍 Owner](${ExplorerAddressUrl(position.owner)})`;
}
