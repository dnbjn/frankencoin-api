import { All, Body, Controller, HttpException, Logger, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { CONFIG, ponderAccessHeaders } from 'app.config';

@ApiExcludeController()
@Controller('graphql')
export class PonderProxyController {
	private readonly logger = new Logger(PonderProxyController.name);

	@All()
	async proxy(@Req() req: Request, @Res() res: Response, @Body() body: unknown) {
		const targets: { url: string; isPrimary: boolean }[] = [
			{ url: CONFIG.indexer, isPrimary: true },
			...(CONFIG.backupIndexer ? [{ url: CONFIG.backupIndexer, isPrimary: false }] : []),
		];

		let lastStatus: number | null = null;
		let lastBody: string | null = null;
		let lastContentType: string | null = null;
		let lastError: unknown;

		for (const target of targets) {
			try {
				const upstream = await fetch(target.url, {
					method: req.method,
					headers: {
						'Content-Type': 'application/json',
						Accept: 'application/json',
						...(target.isPrimary ? ponderAccessHeaders() : {}),
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
