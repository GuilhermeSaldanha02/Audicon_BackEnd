import { Module } from '@nestjs/common';
import { CondominiumsController } from './condominiums.controller';
import { CondominiumsService } from './condominiums.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Condominium } from './entities/condominium.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Condominium])],
  controllers: [CondominiumsController],
  providers: [CondominiumsService],
  exports: [CondominiumsService],
})
export class CondominiumsModule {}
