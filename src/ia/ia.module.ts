import { Module } from '@nestjs/common';
import { IaService } from './ia.service';
import { CondominiumsModule } from 'src/condominiums/condominiums.module';

@Module({
  imports: [CondominiumsModule],
  providers: [IaService],
  exports: [IaService],
})
export class IaModule {}
