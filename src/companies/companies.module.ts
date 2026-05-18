import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from './entities/company.entity';
import { User } from '../users/entities/user.entity';
import { CompaniesService } from './companies.service';
import { CompaniesController } from './companies.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Company, User])],
  controllers: [CompaniesController],
  providers: [CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
