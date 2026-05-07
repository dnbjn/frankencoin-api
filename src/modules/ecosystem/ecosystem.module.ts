import { forwardRef, Module } from '@nestjs/common';
import { DatabaseModule } from 'core/database/database.module';
import { DataSourceModule } from 'core/data-source/data-source.module';
import { PositionsModule } from 'modules/positions/positions.module';
import { PricesModule } from 'modules/prices/prices.module';
import { EcosystemCoinmarketcapController } from './ecosystem.coinmarketcap.controller';
import { EcosystemCollateralController } from './ecosystem.collateral.controller';
import { EcosystemCollateralService } from './ecosystem.collateral.service';
import { EcosystemFpsController } from './ecosystem.fps.controller';
import { EcosystemFpsService } from './ecosystem.fps.service';
import { EcosystemFrankencoinController } from './ecosystem.frankencoin.controller';
import { EcosystemFrankencoinService } from './ecosystem.frankencoin.service';
import { EcosystemMinterController } from './ecosystem.minter.controller';
import { EcosystemMinterService } from './ecosystem.minter.service';

@Module({
	imports: [DataSourceModule, DatabaseModule, PositionsModule, forwardRef(() => PricesModule)],
	controllers: [
		EcosystemMinterController,
		EcosystemCollateralController,
		EcosystemFpsController,
		EcosystemFrankencoinController,
		EcosystemCoinmarketcapController,
	],
	providers: [EcosystemMinterService, EcosystemCollateralService, EcosystemFpsService, EcosystemFrankencoinService],
	exports: [EcosystemMinterService, EcosystemCollateralService, EcosystemFpsService, EcosystemFrankencoinService],
})
export class EcosystemModule {}
