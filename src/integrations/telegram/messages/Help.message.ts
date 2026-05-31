import { AppUrl } from 'utils/func-helper';
import { mainnet } from 'viem/chains';

const HANDLE_LABELS: Record<string, string> = {
	'/MintingUpdates': '📊 Minting Updates',
	'/PriceAlerts': '⚠️ Price Alerts',
	'/WeeklyInfos': '📅 Weekly Infos',
};

export function HelpMessage(handles: string[], chatSubs: { [handle: string]: boolean }): string {
	const subscriptionLines = handles
		.filter((h) => h !== '/help')
		.map((h) => {
			const key = h.replace('/', '');
			const label = HANDLE_LABELS[h] ?? h;
			const status = chatSubs[key] ? '✅' : '⬜';
			return `${status} ${label}`;
		})
		.join('\n');

	return `ℹ️ *Frankencoin Bot*

Monitoring the Frankencoin ecosystem on ${mainnet.name} (chain ${mainnet.id}).

📡 *Subscriptions*
${subscriptionLines}

Use /subscribe to toggle alert types.

v${process.env.npm_package_version} · [🌐 App](${AppUrl('')})`;
}
