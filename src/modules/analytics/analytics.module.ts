import { Module } from '@nestjs/common';
import { DataSourceModule } from 'core/data-source/data-source.module';
import { EcosystemModule } from 'modules/ecosystem/ecosystem.module';
import { PositionsModule } from 'modules/positions/positions.module';
import { SavingsModule } from 'modules/savings/savings.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

@Module({
	imports: [DataSourceModule, PositionsModule, EcosystemModule, SavingsModule],
	controllers: [AnalyticsController],
	providers: [AnalyticsService],
	exports: [AnalyticsService],
})
export class AnalyticsModule {}
