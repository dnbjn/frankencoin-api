import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';

// Core infrastructure
import { DatabaseModule } from 'core/database/database.module';
import { DataSourceModule } from 'core/data-source/data-source.module';

// Config namespaces
import { appConfig, ponderConfig, viemConfig, coingeckoConfig } from 'config/index';

// Feature modules
import { AnalyticsModule } from 'modules/analytics/analytics.module';
import { BridgeModule } from 'modules/bridge/bridge.module';
import { ChallengesModule } from 'modules/challenges/challenges.module';
import { EcosystemModule } from 'modules/ecosystem/ecosystem.module';
import { PositionsModule } from 'modules/positions/positions.module';
import { PricesModule } from 'modules/prices/prices.module';
import { SavingsModule } from 'modules/savings/savings.module';
import { TelegramModule } from 'integrations/telegram/telegram.module';
import { TransferModule } from 'modules/transfer/transfer.module';

// Root orchestration service
import { ApiService } from 'app.service';

@Module({
	imports: [
		// Framework
		ConfigModule.forRoot({
			isGlobal: true,
			load: [appConfig, ponderConfig, viemConfig, coingeckoConfig],
		}),
		ScheduleModule.forRoot(),

		// Core infrastructure
		DatabaseModule,
		DataSourceModule,

		// Feature modules
		BridgeModule,
		PositionsModule,
		EcosystemModule,
		PricesModule,
		SavingsModule,
		ChallengesModule,
		TransferModule,
		AnalyticsModule,
		TelegramModule,
	],
	providers: [ApiService],
})
export class AppModule {}
