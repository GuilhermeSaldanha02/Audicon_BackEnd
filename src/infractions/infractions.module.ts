import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InfractionsController } from './infractions.controller';
import { ReportsController } from './reports.controller';
import { ImagesController } from './images.controller';
import { InfractionsService } from './infractions.service';
import { ImagesService } from './images.service';
import { Infraction } from './entities/infraction.entity';
import { InfractionImage } from './entities/infraction-image.entity';
import { UnitsModule } from 'src/units/units.module';
import { IaModule } from 'src/ia/ia.module';
import { PdfModule } from 'src/pdf/pdf.module';
import { CondominiumsModule } from 'src/condominiums/condominiums.module';
import { MailModule } from 'src/mail/mail.module';
import { WhatsappModule } from 'src/whatsapp/whatsapp.module';
import { RbacModule } from '../common/rbac.module';
import { InfractionAccessGuard } from '../common/guards/infraction-access.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Infraction, InfractionImage]),
    UnitsModule,
    IaModule,
    PdfModule,
    CondominiumsModule,
    MailModule,
    WhatsappModule,
    RbacModule,
  ],
  controllers: [InfractionsController, ReportsController, ImagesController],
  providers: [InfractionsService, ImagesService, InfractionAccessGuard],
  exports: [ImagesService],
})
export class InfractionsModule {}
