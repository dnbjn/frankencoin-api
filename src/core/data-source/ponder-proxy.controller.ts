import { All, Body, Controller, HttpException, Logger, Post, Req, Res } from '@nestjs/common';
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

		let lastError: unknown;
		for (const target of targets) {
			try {
				const upstream = await fetch(`${target.url}/graphql`, {
					method: req.method,
					headers: {
						'Content-Type': 'application/json',
						Accept: 'application/json',
						...(target.isPrimary ? ponderAccessHeaders() : {}),
					},
					body: req.method === 'GET' ? undefined : JSON.stringify(body ?? {}),
					signal: AbortSignal.timeout(15000),
				});

				const text = await upstream.text();
				res.status(upstream.status);
				const contentType = upstream.headers.get('content-type');
				if (contentType) res.setHeader('Content-Type', contentType);
				return res.send(text);
			} catch (err) {
				lastError = err;
				this.logger.warn(
					`GraphQL proxy failed against ${target.url}: ${err instanceof Error ? err.message : String(err)}`
				);
			}
		}

		throw new HttpException(
			`Indexer unreachable: ${lastError instanceof Error ? lastError.message : 'unknown'}`,
			502
		);
	}
}
