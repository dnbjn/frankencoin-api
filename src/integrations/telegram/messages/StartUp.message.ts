import { AppUrl } from 'utils/func-helper';
import { mainnet } from 'viem/chains';

export function StartUpMessage(handles: string[]): string {
	const subs = handles.filter((h) => h !== '/help').join(' · ');

	return `🔄 *Frankencoin Bot Restarted*

Back online and monitoring the ${mainnet.name} ecosystem.

📡 ${subs}

v${process.env.npm_package_version} · [🌐 App](${AppUrl('')}) · [📦 GitHub](https://github.com/dnbjn/frankencoin-api)`;
}
