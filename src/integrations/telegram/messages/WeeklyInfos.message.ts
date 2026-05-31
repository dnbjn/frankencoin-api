import { AnalyticsDailyLog } from 'modules/analytics/analytics.types';
import { FrankencoinSupplyQueryObject } from 'modules/ecosystem/ecosystem.frankencoin.types';
import { formatCurrency } from 'utils/format';
import { formatUnits } from 'viem';

function pct(now: bigint, before: bigint): number {
	if (before === 0n) return 0;
	return Number(((now - before) * 10000n) / before) / 100;
}

function arrow(change: number): string {
	return change > 0 ? '▲' : change < 0 ? '▼' : '→';
}

function fmtZCHF(val: bigint): string {
	return formatCurrency(formatUnits(val, 18), 0, 0);
}

export function WeeklyInfosMessage(before: AnalyticsDailyLog, now: AnalyticsDailyLog, supply: FrankencoinSupplyQueryObject): string {
	const tsAfter = new Date(now.date).getTime();
	const tsBefore = new Date(before.date).getTime();

	const keys = Object.keys(supply).map((i) => parseInt(i) * 1000);

	const keyBefore = keys.filter((i) => i <= tsBefore).at(-1);
	const supplyBefore = supply[keyBefore / 1000].supply;

	const keyAfter = keys.filter((i) => i <= tsAfter).at(-1);
	const supplyAfter = supply[keyAfter / 1000].supply;

	const supplyChangePct = (supplyAfter / supplyBefore - 1) * 100;
	const fpsPriceChangePct = pct(BigInt(now.fpsPrice), BigInt(before.fpsPrice));

	const equityNow = BigInt(now.totalEquity);
	const equityBefore = BigInt(before.totalEquity);
	const equityChangePct = pct(equityNow, equityBefore);

	const savingsNow = BigInt(now.totalSavings);
	const savingsBefore = BigInt(before.totalSavings);
	const savingsChangePct = pct(savingsNow, savingsBefore);

	const inSavingsPct = (savingsNow * 10n ** 20n) / BigInt(now.totalSupply);
	const inEquityPct = (equityNow * 10n ** 20n) / BigInt(now.totalSupply);

	return `📊 *Frankencoin Weekly Snapshot*

💵 Total Supply: *${formatCurrency(supplyAfter, 0, 0)} ZCHF*
   30d: ${arrow(supplyChangePct)} *${formatCurrency(supplyChangePct)}%*

💰 Savings: *${fmtZCHF(savingsNow)} ZCHF* (${formatCurrency(formatUnits(inSavingsPct, 18))}% of supply)
	30d: ${arrow(savingsChangePct)} *${formatCurrency(savingsChangePct)}%*

🔒 Equity: *${fmtZCHF(equityNow)} ZCHF* (${formatCurrency(formatUnits(inEquityPct, 18))}% of supply)
   30d: ${arrow(equityChangePct)} *${formatCurrency(equityChangePct)}%*

📈 FPS Price: *${formatCurrency(formatUnits(BigInt(now.fpsPrice), 18), 0, 0)} ZCHF*
   30d: ${arrow(fpsPriceChangePct)} *${formatCurrency(fpsPriceChangePct)}%*`;
}
