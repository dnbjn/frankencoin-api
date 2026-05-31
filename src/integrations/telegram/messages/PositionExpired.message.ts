import { PositionQuery } from 'modules/positions/positions.types';
import { escapeMd, formatCurrency, shortenString } from 'utils/format';
import { AppUrl, ExplorerAddressUrl } from 'utils/func-helper';
import { formatUnits } from 'viem';

export function PositionExpiredMessage(position: PositionQuery): string {
	const bal = parseInt(formatUnits(BigInt(position.collateralBalance), position.collateralDecimals - 2)) / 100;
	const min = parseInt(formatUnits(BigInt(position.minimumCollateral), position.collateralDecimals - 2)) / 100;
	const price = parseInt(formatUnits(BigInt(position.price), 36 - position.collateralDecimals - 2)) / 100;
	const duration = position.challengePeriod * 1000;

	const t0 = new Date(position.expiration * 1000);
	const t1 = new Date(position.expiration * 1000 + duration);
	const t2 = new Date(position.expiration * 1000 + 2 * duration);

	const sym = escapeMd(position.collateralSymbol);
	const name = escapeMd(position.collateralName);

	const header = `💀 *Position Expired*

🏦 Position: \`${shortenString(position.position)}\` (v${position.version})
👤 Owner: \`${shortenString(position.owner)}\`

💎 Collateral: *${name} (${sym})*
   Address: \`${shortenString(position.collateral)}\`
   Balance: *${formatCurrency(bal, 2, 2)} ${sym}* (min *${formatCurrency(min, 2, 2)}*)

💵 Minted: *${formatCurrency(formatUnits(BigInt(position.minted), 18), 2, 2)} ZCHF*
   Reserve: *${formatCurrency(position.reserveContribution / 10000, 1, 1)}%* · Auction: *${Math.floor(position.challengePeriod / 3600)} hours*`;

	const v1Body = `

⚔️ *Challenge Available*
   1x → 0x from: *${t0.toUTCString()}*
   Price (1x): *${formatCurrency(price, 2, 2)} ZCHF/${sym}*
   Zero at: *${t1.toUTCString()}*`;

	const v2Body = `

⚡ *ForceSell Available*
   10x → 1x from: *${t0.toUTCString()}* (Price: *${formatCurrency(price * 10, 2, 2)} ZCHF*)
   1x → 0x from: *${t1.toUTCString()}* (Price: *${formatCurrency(price, 2, 2)} ZCHF*)
   Zero at: *${t2.toUTCString()}*`;

	const footer = `

[📋 Overview](${AppUrl(`/monitoring/${position.position}`)}) · [💸 Buy Collateral](${AppUrl(`/monitoring/${position.position}/${position.version == 1 ? 'challenge' : 'forceSell'}`)})
[🔍 Position](${ExplorerAddressUrl(position.position)}) · [🔍 Owner](${ExplorerAddressUrl(position.owner)})`;

	return header + (position.version == 1 ? v1Body : v2Body) + footer;
}
