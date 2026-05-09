import { Module } from '@nestjs/common';
import { IndexerHealthService } from './indexer-health.service';
import { DataSourceManagerService } from './data-source.manager.service';
import { StatusController } from './status.controller';
import { StatusService } from './status.service';
import { PonderProxyController } from './ponder-proxy.controller';

/**
 * DataSourceModule - Provides indexer health monitoring and failover management
 *
 * Exports:
 * - IndexerHealthService: Monitors primary/backup indexer health
 * - DataSourceManagerService: Manages three-tier failover (primary -> backup)
 * - StatusService: Provides system status information
 *
 * Controllers:
 * - StatusController: GET /status endpoint for system health
 */
@Module({
	controllers: [StatusController, PonderProxyController],
	providers: [IndexerHealthService, DataSourceManagerService, StatusService],
	exports: [IndexerHealthService, DataSourceManagerService, StatusService],
})
export class DataSourceModule {}
