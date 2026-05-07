import { Module } from '@nestjs/common';
import { DataSourceModule } from 'core/data-source/data-source.module';
import { EcosystemModule } from 'modules/ecosystem/ecosystem.module';
import { SavingsCoreController } from './savings.core.controller';
import { SavingsCoreService } from './savings.core.service';
import { SavingsLeadrateController } from './savings.leadrate.controller';
import { SavingsLeadrateService } from './savings.leadrate.service';
import { SavingsReferrerController } from './savings.referrer.controller';
import { SavingsReferrerService } from './savings.referrer.service';

@Module({
	imports: [DataSourceModule, EcosystemModule],
	controllers: [SavingsLeadrateController, SavingsCoreController, SavingsReferrerController],
	providers: [SavingsLeadrateService, SavingsCoreService, SavingsReferrerService],
	exports: [SavingsLeadrateService, SavingsCoreService, SavingsReferrerService],
})
export class SavingsModule {}
