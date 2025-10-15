import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InfractionsController } from './infractions.controller';
import { InfractionsService } from './infractions.service';
import { Infraction } from './entities/infraction.entity';
import { UnitsModule } from 'src/units/units.module';
import { IaModule } from 'src/ia/ia.module';
import { PdfModule } from 'src/pdf/pdf.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Infraction]),
    UnitsModule,
    IaModule,
    PdfModule,
  ],
  controllers: [InfractionsController],
  providers: [InfractionsService],
})
export class InfractionsModule {}
