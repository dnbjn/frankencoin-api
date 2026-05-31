import { PriceQuery } from 'modules/prices/prices.types';
import { PositionQuery } from 'modules/positions/positions.types';
import { escapeMd, formatCurrency, shortenString } from 'utils/format';
import { AppUrl } from 'utils/func-helper';
import { formatUnits } from 'viem';
import { PositionPriceAlertState } from 'integrations/telegram/telegram.types';

function priceBody(position: PositionQuery, price: PriceQuery): string {
	const bal = parseInt(formatUnits(BigInt(position.collateralBalance), position.collateralDecimals - 2)) / 100;
	const posPrice = parseFloat(formatUnits(BigInt(position.price), 36 - position.collateralDecimals));

	const sym = escapeMd(position.collateralSymbol);
	const name = escapeMd(position.collateralName);

	return `🏦 Position: \`${shortenString(position.position)}\`
💎 *${name} (${sym})* — *${formatCurrency(bal, 2, 2)} ${sym}*

   Liq. Price: *${formatCurrency(posPrice, 2, 2)} ZCHF*
   Market Price: *${formatCurrency(price.price.chf, 2, 2)} ZCHF*`;
}

export function PositionPriceLowest(position: PositionQuery, price: PriceQuery, last: PositionPriceAlertState): string {
	const posPrice = parseFloat(formatUnits(BigInt(position.price), 36 - position.collateralDecimals));
	const ratio = Math.round((price.price.chf / posPrice) * 10000) / 100;

	return `🔴 *Position Undercollateralized*

${priceBody(position, price)}
   *Collateralization: ${ratio}%* 🔴

[⚔️ Challenge](${AppUrl(`/monitoring/${position.position}/challenge`)}) · [📋 Position](${AppUrl(`/monitoring/${position.position}`)})`;
}

export function PositionPriceAlert(position: PositionQuery, price: PriceQuery, last: PositionPriceAlertState): string {
	const posPrice = parseFloat(formatUnits(BigInt(position.price), 36 - position.collateralDecimals));
	const ratio = Math.round((price.price.chf / posPrice) * 10000) / 100;

	return `🚨 *Price Alert*

${priceBody(position, price)}
   *Collateralization: ${ratio}%* 🚨

[⚔️ Challenge](${AppUrl(`/monitoring/${position.position}/challenge`)}) · [📋 Position](${AppUrl(`/monitoring/${position.position}`)})`;
}

export function PositionPriceWarning(position: PositionQuery, price: PriceQuery, last: PositionPriceAlertState): string {
	const posPrice = parseFloat(formatUnits(BigInt(position.price), 36 - position.collateralDecimals));
	const ratio = Math.round((price.price.chf / posPrice) * 10000) / 100;

	return `⚠️ *Price Warning*

${priceBody(position, price)}
   *Collateralization: ${ratio}%* ⚠️

[⚔️ Challenge](${AppUrl(`/monitoring/${position.position}/challenge`)}) · [📋 Position](${AppUrl(`/monitoring/${position.position}`)})`;
}
