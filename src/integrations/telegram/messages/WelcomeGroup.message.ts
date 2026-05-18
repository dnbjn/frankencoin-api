import { AppUrl } from 'utils/func-helper';
import { mainnet } from 'viem/chains';

export function WelcomeGroupMessage(group: string | number, handles: string[]): string {
	const subscriptions = handles
		.filter((h) => h !== '/help')
		.map((h) => {
			const labels: Record<string, string> = {
				'/MintingUpdates': '📊 /MintingUpdates — new minting transactions',
				'/PriceAlerts': '⚠️ /PriceAlerts — collateral price warnings',
				'/DailyInfos': '📅 /DailyInfos — weekly ecosystem summary',
			};
			return labels[h] ?? h;
		})
		.join('\n');

	return `👋 *Welcome to Frankencoin Bot*

This chat (\`${group}\`) is now connected to the Frankencoin ecosystem monitor on ${mainnet.name}.

📡 *Optional Subscriptions*
${subscriptions}

Use /subscribe to manage alerts or /help for status.

v${process.env.npm_package_version} · [🌐 App](${AppUrl('')}) · [📦 GitHub](https://github.com/dnbjn/frankencoin-api)`;
}
