import { Test, TestingModule } from '@nestjs/testing';
import { PdfService } from './pdf.service';
import PDFMod from 'pdfkit';

// Mock do módulo pdfkit evitando problemas de hoisting com jest.mock
jest.mock('pdfkit', () => {
  type EventCallback = (...args: any[]) => void;
  const listeners: Record<string, EventCallback | undefined> = {};
  const state = { error: false };
  let instance: any;
  const PDFCtor: any = jest.fn().mockImplementation(() => {
    instance = {
      on: jest.fn((event: string, cb: EventCallback) => {
        listeners[event] = cb;
      }),
      fontSize: jest.fn(() => instance),
      text: jest.fn(() => instance),
      moveDown: jest.fn(() => instance),
      end: jest.fn(() => {
        if (state.error) {
          if (listeners['error']) {
            (listeners['error'] as EventCallback)(new Error('pdf error'));
          }
          return;
        }
        if (listeners['data']) {
          (listeners['data'] as EventCallback)(Buffer.from('mock-data'));
        }
        if (listeners['end']) {
          (listeners['end'] as EventCallback)();
        }
      }),
    };
    return instance;
  });
  PDFCtor.__setError = (val: boolean) => (state.error = val);
  PDFCtor.__getInstance = () => instance;
  return PDFCtor;
});

describe('PdfService', () => {
  let service: PdfService;

  beforeEach(async () => {
    // limpa estado e chamadas do mock
    (PDFMod as any).__setError(false);
    (PDFMod as any).mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [PdfService],
    }).compile();

    service = module.get<PdfService>(PdfService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('gera buffer de PDF com dados da infração (sucesso)', async () => {
    const infraction: any = {
      unit: {
        identifier: 'A101',
        ownerName: 'John Doe',
        condominium: { name: 'Condo Alpha' },
      },
      occurrenceDate: new Date('2024-06-08T10:00:00Z'),
      formalDescription: 'Descrição formal gerada pela IA',
      suggestedPenalty: 'Warning',
    };

    const buffer = await service.gerarDocumentoInfracao(infraction);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);

    // Verifica chamadas básicas de construção
    const inst = (PDFMod as any).__getInstance();
    expect(PDFMod).toHaveBeenCalledTimes(1);
    expect(inst.fontSize).toHaveBeenCalled();
    expect(inst.text).toHaveBeenCalled();
    expect(inst.moveDown).toHaveBeenCalled();
    expect(inst.end).toHaveBeenCalledTimes(1);
  });

  it('propaga erro quando o PDF emite erro', async () => {
    const infraction: any = {
      unit: {
        identifier: 'B202',
        ownerName: 'Jane Roe',
        condominium: { name: 'Condo Beta' },
      },
      occurrenceDate: new Date('2024-06-08T10:00:00Z'),
      formalDescription: 'Texto',
      suggestedPenalty: 'Fine',
    };

    (PDFMod as any).__setError(true);

    await expect(service.gerarDocumentoInfracao(infraction)).rejects.toThrow(
      'pdf error',
    );
    const inst = (PDFMod as any).__getInstance();
    expect(PDFMod).toHaveBeenCalledTimes(1);
    expect(inst.end).toHaveBeenCalledTimes(1);
  });
});
