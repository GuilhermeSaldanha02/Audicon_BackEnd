import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from './entities/company.entity';
import { User } from '../users/entities/user.entity';
import { UserCondominium } from '../users/entities/user-condominium.entity';
import { CompaniesService } from './companies.service';
import { CompaniesController } from './companies.controller';
import { EmployeesController } from './employees.controller';
import { CompanyAdminGuard } from '../common/guards/company-admin.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Company, User, UserCondominium])],
  controllers: [CompaniesController, EmployeesController],
  providers: [CompaniesService, CompanyAdminGuard],
  exports: [CompaniesService],
})
export class CompaniesModule {}
