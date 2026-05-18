import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Infraction } from '../infractions/entities/infraction.entity';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [TypeOrmModule.forFeature([Infraction])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
