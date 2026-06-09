import { Test, TestingModule } from '@nestjs/testing';
import { PdfService } from './pdf.service';
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
      pipe: jest.fn(() => instance),
      fontSize: jest.fn(() => instance),
      text: jest.fn(() => instance),
      moveDown: jest.fn(() => instance),
      addPage: jest.fn(() => instance),
      image: jest.fn(() => instance),
      page: { margins: { left: 50 } },
      y: 100,
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
  return { __esModule: true, default: PDFCtor };
});
const getPDFMockCtor = () => (jest.requireMock('pdfkit') as any).default;
describe('PdfService', () => {
  let service: PdfService;
  beforeEach(async () => {
    const PDFCtor = getPDFMockCtor();
    PDFCtor.__setError(false);
    PDFCtor.mockClear();
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
    const PDFCtor = getPDFMockCtor();
    const inst = PDFCtor.__getInstance();
    expect(PDFCtor).toHaveBeenCalledTimes(1);
    expect(inst.fontSize).toHaveBeenCalled();
    expect(inst.text).toHaveBeenCalled();
    expect(inst.moveDown).toHaveBeenCalled();
    expect(inst.end).toHaveBeenCalledTimes(1);
  });
  it('streamInfractionReport faz pipe no sink, escreve cabeçalho e conclui', async () => {
    const condominium: any = {
      id: 5,
      name: 'Condo Alpha',
      cnpj: '00.000.000/0001-00',
      address: 'Rua A, 1',
    };
    const infractions: any[] = [
      {
        id: 1,
        description: 'Barulho',
        occurrenceDate: new Date('2026-01-01T10:00:00Z'),
        unit: { identifier: 'A101', ownerName: 'John' },
        formalDescription: 'Formal text',
        suggestedPenalty: 'Warning',
      },
      {
        id: 2,
        description: 'Outra',
        occurrenceDate: new Date('2026-02-01T10:00:00Z'),
        unit: { identifier: 'B202', ownerName: 'Jane' },
      },
    ];
    const sink: any = { write: jest.fn(), end: jest.fn(), on: jest.fn() };
    await service.streamInfractionReport(sink, condominium, infractions);
    const PDFCtor = getPDFMockCtor();
    const inst = PDFCtor.__getInstance();
    expect(inst.pipe).toHaveBeenCalledWith(sink);
    expect(inst.text).toHaveBeenCalled();
    expect(inst.end).toHaveBeenCalledTimes(1);
  });
  it('streamInfractionReport com lista vazia escreve mensagem de zero infrações', async () => {
    const condominium: any = {
      id: 5,
      name: 'Condo Alpha',
      cnpj: '00.000.000/0001-00',
      address: 'Rua A, 1',
    };
    const sink: any = { write: jest.fn(), end: jest.fn(), on: jest.fn() };
    await service.streamInfractionReport(sink, condominium, []);
    const PDFCtor = getPDFMockCtor();
    const inst = PDFCtor.__getInstance();
    expect(inst.pipe).toHaveBeenCalledWith(sink);
    const allTextCalls = (inst.text as jest.Mock).mock.calls
      .map((c) => c[0])
      .join(' ');
    expect(allTextCalls).toContain('Nenhuma infração encontrada');
  });
  it('renderiza página de evidências quando recebe imagens', async () => {
    const infraction: any = {
      unit: {
        identifier: 'A101',
        ownerName: 'John',
        condominium: { name: 'Condo' },
      },
      occurrenceDate: new Date('2024-06-08T10:00:00Z'),
      formalDescription: 'F',
      suggestedPenalty: 'W',
    };
    const buffers = [
      Buffer.from('img1'),
      Buffer.from('img2'),
      Buffer.from('img3'),
    ];
    await service.gerarDocumentoInfracao(infraction, buffers);
    const PDFCtor = getPDFMockCtor();
    const inst = PDFCtor.__getInstance();
    expect(inst.addPage).toHaveBeenCalledTimes(1);
    expect(inst.image).toHaveBeenCalledTimes(3);
  });
  it('limita renderização a 4 imagens mesmo recebendo mais', async () => {
    const infraction: any = {
      unit: {
        identifier: 'A101',
        ownerName: 'John',
        condominium: { name: 'Condo' },
      },
      occurrenceDate: new Date(),
      formalDescription: 'F',
      suggestedPenalty: 'W',
    };
    const buffers = Array.from({ length: 8 }, (_, i) => Buffer.from(`img${i}`));
    await service.gerarDocumentoInfracao(infraction, buffers);
    const PDFCtor = getPDFMockCtor();
    const inst = PDFCtor.__getInstance();
    expect(inst.image).toHaveBeenCalledTimes(4);
  });
  it('ignora imagem inválida sem propagar erro', async () => {
    const infraction: any = {
      unit: {
        identifier: 'A101',
        ownerName: 'John',
        condominium: { name: 'Condo' },
      },
      occurrenceDate: new Date(),
      formalDescription: 'F',
      suggestedPenalty: 'W',
    };
    const PDFCtor = getPDFMockCtor();
    // override image to throw on first call
    const buffer = await (async () => {
      const result = service.gerarDocumentoInfracao(infraction, [
        Buffer.from('bad'),
      ]);
      const inst = PDFCtor.__getInstance();
      (inst.image as jest.Mock).mockImplementationOnce(() => {
        throw new Error('invalid image');
      });
      return result;
    })();
    expect(Buffer.isBuffer(buffer)).toBe(true);
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
    const PDFCtor = getPDFMockCtor();
    PDFCtor.__setError(true);
    await expect(service.gerarDocumentoInfracao(infraction)).rejects.toThrow(
      'pdf error',
    );
    const inst = PDFCtor.__getInstance();
    expect(PDFCtor).toHaveBeenCalledTimes(1);
    expect(inst.end).toHaveBeenCalledTimes(1);
  });
});
