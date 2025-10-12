import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UnidadesController } from './unidades.controller';
import { UnidadesService } from './unidades.service';
import { Unidade } from './entities/unidade.entity';
import { CondominiosModule } from 'src/condominios/condominios.module';

@Module({
  imports: [TypeOrmModule.forFeature([Unidade]), CondominiosModule],
  controllers: [UnidadesController],
  providers: [UnidadesService]
})
export class UnidadesModule {}
