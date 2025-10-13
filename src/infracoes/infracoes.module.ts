import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InfracoesController } from './infracoes.controller';
import { InfracoesService } from './infracoes.service';
import { Infracao } from './entities/infracao.entity';
import { Unidade } from 'src/unidades/entities/unidade.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Infracao, Unidade])],
  controllers: [InfracoesController],
  providers: [InfracoesService]
})
export class InfracoesModule {}
