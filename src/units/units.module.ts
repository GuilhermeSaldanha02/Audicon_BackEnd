import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UnitsController } from './units.controller';
import { UnitsService } from './units.service';
import { Unit } from './entities/unit.entity';
import { CondominiumsModule } from 'src/condominiums/condominiums.module';

@Module({
  imports: [TypeOrmModule.forFeature([Unit]), CondominiumsModule],
  controllers: [UnitsController],
  providers: [UnitsService],
  exports: [UnitsService],
})
export class UnitsModule {}
