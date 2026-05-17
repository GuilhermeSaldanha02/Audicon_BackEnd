import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InfractionsController } from './infractions.controller';
import { ReportsController } from './reports.controller';
import { InfractionsService } from './infractions.service';
import { Infraction } from './entities/infraction.entity';
import { UnitsModule } from 'src/units/units.module';
import { IaModule } from 'src/ia/ia.module';
import { PdfModule } from 'src/pdf/pdf.module';
import { CondominiumsModule } from 'src/condominiums/condominiums.module';
import { MailModule } from 'src/mail/mail.module';
import { RbacModule } from '../common/rbac.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Infraction]),
    UnitsModule,
    IaModule,
    PdfModule,
    CondominiumsModule,
    MailModule,
    RbacModule,
  ],
  controllers: [InfractionsController, ReportsController],
  providers: [InfractionsService],
})
export class InfractionsModule {}
