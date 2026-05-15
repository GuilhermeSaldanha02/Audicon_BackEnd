import { Test, TestingModule } from '@nestjs/testing';
import { ReportsController } from './reports.controller';
import { InfractionsService } from './infractions.service';
import { PdfService } from '../pdf/pdf.service';
import { RolesGuard } from '../common/guards/roles.guard';

describe('ReportsController', () => {
  let controller: ReportsController;
  let infractions: { findForReport: jest.Mock };
  let pdf: { streamInfractionReport: jest.Mock };

  beforeEach(async () => {
    infractions = { findForReport: jest.fn() };
    pdf = { streamInfractionReport: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        { provide: InfractionsService, useValue: infractions },
        { provide: PdfService, useValue: pdf },
      ],
    })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ReportsController>(ReportsController);
  });

  it('seta headers e delega para PdfService', async () => {
    const condo = { id: 5, name: 'Condo Alpha' };
    const list = [{ id: 1 }];
    infractions.findForReport.mockResolvedValue({
      condominium: condo,
      infractions: list,
    });
    pdf.streamInfractionReport.mockResolvedValue(undefined);
    const res: any = { set: jest.fn() };
    await controller.getReport(5, { from: '2026-01-01' } as any, res);
    expect(infractions.findForReport).toHaveBeenCalledWith(5, '2026-01-01', undefined);
    expect(res.set).toHaveBeenCalledWith(
      expect.objectContaining({
        'Content-Type': 'application/pdf',
        'Content-Disposition': expect.stringContaining('attachment; filename="infractions-5-'),
      }),
    );
    expect(pdf.streamInfractionReport).toHaveBeenCalledWith(res, condo, list);
  });
});
