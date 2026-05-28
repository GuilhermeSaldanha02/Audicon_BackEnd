import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Condominium } from '../condominiums/entities/condominium.entity';
import { RolesGuard } from './guards/roles.guard';
import { CondominiumAccessGuard } from './guards/condominium-access.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Condominium])],
  providers: [RolesGuard, CondominiumAccessGuard],
  exports: [RolesGuard, CondominiumAccessGuard, TypeOrmModule],
})
export class RbacModule {}
