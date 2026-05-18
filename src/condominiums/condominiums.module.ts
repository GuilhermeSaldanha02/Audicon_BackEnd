import { Module } from '@nestjs/common';
import { CondominiumsController } from './condominiums.controller';
import { CondominiumsService } from './condominiums.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Condominium } from './entities/condominium.entity';
import { RbacModule } from '../common/rbac.module';
import { UsersModule } from '../users/users.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Condominium]),
    RbacModule,
    UsersModule,
    AuditModule,
  ],
  controllers: [CondominiumsController],
  providers: [CondominiumsService],
  exports: [CondominiumsService],
})
export class CondominiumsModule {}
