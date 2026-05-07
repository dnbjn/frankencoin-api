import { Module } from '@nestjs/common';
import { DataSourceModule } from 'core/data-source/data-source.module';
import { TransferReferenceController } from './tranfer.reference.controller';
import { TransferReferenceService } from './transfer.reference.service';

@Module({
	imports: [DataSourceModule],
	controllers: [TransferReferenceController],
	providers: [TransferReferenceService],
	exports: [TransferReferenceService],
})
export class TransferModule {}
