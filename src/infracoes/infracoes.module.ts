import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InfracoesController } from './infracoes.controller';
import { InfracoesService } from './infracoes.service';
import { Infracao } from './entities/infracao.entity';
import { UnidadesModule } from 'src/unidades/unidades.module';
import { IaModule } from 'src/ia/ia.module';
import { PdfModule } from 'src/pdf/pdf.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Infracao]),
    UnidadesModule,
    IaModule,
    PdfModule,
  ],
  controllers: [InfracoesController],
  providers: [InfracoesService]
})
export class InfracoesModule {}
