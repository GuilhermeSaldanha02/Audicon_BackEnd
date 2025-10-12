import { Module } from '@nestjs/common';
import { CondominiosController } from './condominios.controller';
import { CondominiosService } from './condominios.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Condominio } from './entities/condominio.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Condominio])],
  controllers: [CondominiosController],
  providers: [CondominiosService],
  exports: [CondominiosService],
})
export class CondominiosModule {}
