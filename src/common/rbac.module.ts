import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserCondominium } from '../users/entities/user-condominium.entity';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [TypeOrmModule.forFeature([UserCondominium])],
  providers: [RolesGuard],
  exports: [RolesGuard, TypeOrmModule],
})
export class RbacModule {}
