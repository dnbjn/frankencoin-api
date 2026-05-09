import { All, Body, Controller, HttpException, Logger, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { CONFIG, ponderAccessHeaders } from 'app.config';
import { DataSourceManagerService } from './data-source.manager.service';

@ApiExcludeController()
@Controller('graphql')
export class PonderProxyController {
	private readonly logger = new Logger(PonderProxyController.name);

	constructor(private readonly dataSource: DataSourceManagerService) {}

	@All()
	async proxy(@Req() req: Request, @Res() res: Response, @Body() body: unknown) {
		// Use the health-aware source picker so the proxy honors the same staleness
		// definition as the workflow. Falls through to the other target on any non-2xx.
		const preferred = this.dataSource.determineSource();
		const primary = { url: CONFIG.indexer, isPrimary: true };
		const backup = CONFIG.backupIndexer ? { url: CONFIG.backupIndexer, isPrimary: false } : null;

		const targets: { url: string; isPrimary: boolean }[] =
			preferred === 'backup' && backup
				? [backup, primary]
				: [primary, ...(backup ? [backup] : [])];

		let lastStatus: number | null = null;
		let lastBody: string | null = null;
		let lastContentType: string | null = null;
		let lastError: unknown;

		// Some Cloudflare WAF rules treat empty/default UA as bot and 403. Always send *some*
		// User-Agent. For trusted primary (own infra) forward the client UA so it shows up
		// in our logs; for any third party (backup, or a primary that's been misconfigured
		// to a public mirror), send only a static service UA — leaking client UAs to
		// upstreams we don't control isn't necessary and isn't ours to share.
		const clientUserAgent = (req.headers['user-agent'] as string) || 'frankencoin-api-proxy/1.0';
		const serviceUserAgent = 'frankencoin-api-proxy/1.0';

		// X-Forwarded-For carries end-user PII. Forward it only to a trusted primary;
		// never to a third-party indexer.
		const existingXff = req.headers['x-forwarded-for'];
		const xForwardedForPrimary = existingXff
			? `${Array.isArray(existingXff) ? existingXff.join(', ') : existingXff}, ${req.ip}`
			: req.ip;

		// Trust signal: presence of CF-Access creds is the operator's declaration that
		// "primary is private infrastructure I control and gate." If creds are absent,
		// CONFIG.indexer may have been pointed at a public mirror — treat it as a third
		// party and don't forward UA, client IP, or any secrets to it.
		const cfHeaders = ponderAccessHeaders();
		const primaryIsTrusted = Object.keys(cfHeaders).length > 0;

		for (const target of targets) {
			try {
				const trusted = target.isPrimary && primaryIsTrusted;
				// NOTE: All requests use POST, if GET is needed in the future, add handling here (and ensure ponderAccessHeaders are only sent for POST)
				const upstream = await fetch(target.url, {
					method: req.method,
					headers: {
						'Content-Type': 'application/json',
						Accept: 'application/json',
						'User-Agent': trusted ? clientUserAgent : serviceUserAgent,
						...(trusted ? { 'X-Forwarded-For': xForwardedForPrimary } : {}),
						...(trusted ? cfHeaders : {}),
					},
					body: req.method === 'GET' ? undefined : JSON.stringify(body ?? {}),
					cache: 'no-store',
					signal: AbortSignal.timeout(15000),
				});

				const text = await upstream.text();
				lastStatus = upstream.status;
				lastBody = text;
				lastContentType = upstream.headers.get('content-type');

				// Forward 2xx immediately; for any other status, fall through to next target
				if (upstream.ok) {
					res.status(upstream.status);
					if (lastContentType) res.setHeader('Content-Type', lastContentType);
					res.setHeader('Cache-Control', 'no-store');
					return res.send(text);
				}

				this.logger.warn(
					`GraphQL proxy got ${upstream.status} from ${target.url}, trying next target if available`
				);
			} catch (err) {
				lastError = err;
				this.logger.warn(
					`GraphQL proxy failed against ${target.url}: ${err instanceof Error ? err.message : String(err)}`
				);
			}
		}

		// All targets exhausted — return the last upstream response if any (preserves error body for debugging)
		if (lastStatus !== null && lastBody !== null) {
			res.status(lastStatus);
			if (lastContentType) res.setHeader('Content-Type', lastContentType);
			res.setHeader('Cache-Control', 'no-store');
			return res.send(lastBody);
		}

		throw new HttpException(
			`Indexer unreachable: ${lastError instanceof Error ? lastError.message : 'unknown'}`,
			502
		);
	}
}
