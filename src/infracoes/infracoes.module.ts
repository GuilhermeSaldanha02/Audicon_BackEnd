import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InfracoesController } from './infracoes.controller';
import { InfracoesService } from './infracoes.service';
import { Infracao } from './entities/infracao.entity';
import { UnidadesModule } from 'src/unidades/unidades.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Infracao]),
    UnidadesModule,
  ],
  controllers: [InfracoesController],
  providers: [InfracoesService]
})
export class InfracoesModule {}
