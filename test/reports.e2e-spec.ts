import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { ReportsController } from '../src/infractions/reports.controller';
import { InfractionsService } from '../src/infractions/infractions.service';
import { PdfService } from '../src/pdf/pdf.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { setupApp } from '../src/setup-app';
import { ConfigService } from '@nestjs/config';

const condo = {
  id: 5,
  name: 'Condo Alpha',
  cnpj: '00.000.000/0001-00',
  address: 'Rua A, 1',
};

describe('Reports (e2e)', () => {
  let app: INestApplication;
  let infractionsService: { findForReport: jest.Mock };
  let pdfService: { streamInfractionReport: jest.Mock };

  beforeAll(async () => {
    infractionsService = { findForReport: jest.fn() };
    pdfService = {
      streamInfractionReport: jest.fn().mockImplementation(async (res: any) => {
        res.write(Buffer.from('%PDF-1.4 fake'));
        res.end();
      }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        { provide: InfractionsService, useValue: infractionsService },
        { provide: PdfService, useValue: pdfService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) =>
              key === 'CORS_ORIGINS' ? 'http://localhost' : undefined,
            ),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('200 com PDF e headers corretos', async () => {
    infractionsService.findForReport.mockResolvedValue({
      condominium: condo,
      infractions: [],
    });
    const res = await request(app.getHttpServer())
      .get('/api/v1/condominiums/5/infractions/report.pdf')
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c as Buffer));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toContain(
      'attachment; filename="infractions-5-',
    );
    expect((res.body as Buffer).slice(0, 5).toString()).toBe('%PDF-');
  });

  it('400 quando from não é data ISO', async () => {
    const res = await request(app.getHttpServer()).get(
      '/api/v1/condominiums/5/infractions/report.pdf?from=not-a-date',
    );
    expect(res.status).toBe(400);
  });

  it('passa from e to para o service', async () => {
    infractionsService.findForReport.mockResolvedValue({
      condominium: condo,
      infractions: [],
    });
    await request(app.getHttpServer())
      .get(
        '/api/v1/condominiums/5/infractions/report.pdf?from=2026-01-01&to=2026-12-31',
      )
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c as Buffer));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(infractionsService.findForReport).toHaveBeenCalledWith(
      5,
      '2026-01-01',
      '2026-12-31',
    );
  });
});
