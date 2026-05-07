import { Module } from '@nestjs/common';
import { DataSourceModule } from 'core/data-source/data-source.module';
import { ChallengesController } from './challenges.controller';
import { ChallengesService } from './challenges.service';

@Module({
	imports: [DataSourceModule],
	controllers: [ChallengesController],
	providers: [ChallengesService],
	exports: [ChallengesService],
})
export class ChallengesModule {}
