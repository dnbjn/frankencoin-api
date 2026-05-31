import { MintingUpdateQuery } from 'modules/positions/positions.types';
import { PriceQuery, PriceQueryObjectArray } from 'modules/prices/prices.types';
import { escapeMd, formatCurrency, normalizeAddress, shortenString } from 'utils/format';
import { formatUnits } from 'viem';
import { AppUrl, ExplorerAddressUrl, ExplorerTxUrl } from 'utils/func-helper';

export function MintingUpdateMessage(minting: MintingUpdateQuery, prices: PriceQueryObjectArray): string {
	const marketPrice = (prices[normalizeAddress(minting.collateral)] as PriceQuery).price?.chf || 1;
	const liqPrice = parseFloat(formatUnits(BigInt(minting.price), 36 - minting.collateralDecimals));
	const ratio = marketPrice / liqPrice;
	const minted = parseFloat(formatUnits(BigInt(minting.minted), 18));
	const mintedAdjusted = parseFloat(formatUnits(BigInt(minting.mintedAdjusted), 18));
	const timeframeDays = Math.round(minting.feeTimeframe / 86400);
	const sign = mintedAdjusted >= 0 ? '+' : '-';

	const sym = escapeMd(minting.collateralSymbol);
	const name = escapeMd(minting.collateralName);

	return `🔄 *New Minting*

🏦 Position: \`${shortenString(minting.position)}\` (v${minting.version})
👤 Owner: \`${shortenString(minting.owner)}\`

💎 Collateral: *${name} (${sym})*
   Market Price: *${formatCurrency(marketPrice, 2)} ZCHF*
   Liq. Price: *${formatCurrency(liqPrice, 2)} ZCHF*
   *Ratio: ${formatCurrency(ratio * 100, 2)}%*

💵 Minted: *${formatCurrency(minted, 2)} ZCHF*
   *Change: ${sign}${formatCurrency(Math.abs(mintedAdjusted), 2)} ZCHF*

📊 Rates
   Interest: *${formatCurrency(minting.annualInterestPPM / 10000, 2)}%* APY
   Reserve: *${formatCurrency(minting.reserveContribution / 10000, 2)}%*

📊 Fee
   Timeframe: *${timeframeDays} days*
   Rate: *${formatCurrency(minting.feePPM / 10000, 2)}%*
   *Paid: ${formatCurrency(formatUnits(BigInt(minting.feePaid), 18), 2)} ZCHF*

[🔍 Position](${ExplorerAddressUrl(minting.position)}) · [🔍 Owner](${ExplorerAddressUrl(minting.owner)}) · [🔍 Tx](${ExplorerTxUrl(minting.txHash)})`;
}
