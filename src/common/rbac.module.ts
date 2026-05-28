import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserCondominium } from '../users/entities/user-condominium.entity';
import { Condominium } from '../condominiums/entities/condominium.entity';
import { RolesGuard } from './guards/roles.guard';
import { CondominiumAccessGuard } from './guards/condominium-access.guard';

@Module({
  // UserCondominium permanece registrado até o commit #2 deletar a entidade.
  imports: [TypeOrmModule.forFeature([UserCondominium, Condominium])],
  providers: [RolesGuard, CondominiumAccessGuard],
  exports: [RolesGuard, CondominiumAccessGuard, TypeOrmModule],
})
export class RbacModule {}
