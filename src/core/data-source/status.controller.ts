import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { StatusService } from './status.service';

@ApiTags('Status')
@Controller('status')
export class StatusController {
	constructor(private readonly statusService: StatusService) {}

	@Get()
	@ApiOperation({
		summary: 'Get API system status',
		description:
			'Returns health status of primary indexer, backup indexer, database connection, and current data source being used',
	})
	@ApiResponse({
		status: 200,
		description: 'System status information',
		schema: {
			type: 'object',
			properties: {
				api: {
					type: 'object',
					properties: {
						status: { type: 'string', example: 'healthy' },
						version: { type: 'string', example: '0.3.14' },
						uptime: { type: 'number', description: 'Uptime in seconds' },
					},
				},
				dataSources: {
					type: 'object',
					properties: {
						current: {
							type: 'string',
							enum: ['primary', 'backup', 'cache'],
							description: 'Currently active data source',
						},
						primary: {
							type: 'object',
							properties: {
								url: { type: 'string', example: 'https://ponder.zchf.app' },
								status: { type: 'string', enum: ['healthy', 'unhealthy', 'unknown'] },
								blockNumber: { type: 'string', description: 'Latest indexed block' },
								blockTimestamp: { type: 'number', description: 'Latest block timestamp' },
								latency: { type: 'number', description: 'Response time in ms' },
								consecutiveFailures: { type: 'number' },
								lastChecked: { type: 'string', format: 'date-time' },
								error: { type: 'string', nullable: true },
							},
						},
						backup: {
							type: 'object',
							nullable: true,
							properties: {
								url: { type: 'string', example: 'https://ponder.test.frankencoin.com' },
								status: { type: 'string', enum: ['healthy', 'unhealthy', 'unknown'] },
								blockNumber: { type: 'string' },
								blockTimestamp: { type: 'number' },
								latency: { type: 'number' },
								consecutiveFailures: { type: 'number' },
								lastChecked: { type: 'string', format: 'date-time' },
								error: { type: 'string', nullable: true },
							},
						},
					},
				},
				database: {
					type: 'object',
					properties: {
						status: { type: 'string', enum: ['connected', 'disconnected', 'disabled'] },
						enabled: { type: 'boolean' },
					},
				},
			},
		},
	})
	getStatus() {
		return this.statusService.getSystemStatus();
	}
}
