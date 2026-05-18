import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { WhatsappService } from './whatsapp.service';
import {
  Infraction,
  InfractionStatus,
} from '../infractions/entities/infraction.entity';

const baseInfraction = (): Infraction =>
  ({
    id: 1,
    description: 'd',
    formalDescription: 'f',
    suggestedPenalty: 'Advertência',
    status: InfractionStatus.APPROVED,
    occurrenceDate: new Date(),
    updatedAt: new Date(),
    approvedAt: new Date(),
    sentAt: null,
    whatsappSentAt: null,
    unit: {
      identifier: 'A-101',
      ownerName: 'João',
      residentEmail: 'joao@ex.com',
      condominium: { name: 'Condo Alpha' },
    } as any,
  }) as Infraction;

async function build(config: Record<string, any>): Promise<WhatsappService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      WhatsappService,
      {
        provide: ConfigService,
        useValue: { get: (k: string) => config[k] },
      },
    ],
  }).compile();
  const service = module.get(WhatsappService);
  service.onModuleInit();
  return service;
}

describe('WhatsappService', () => {
  describe('normalizePhone', () => {
    it('strip não-dígitos e adiciona DDI 55 para 11 dígitos', () => {
      expect(WhatsappService.normalizePhone('(11) 99999-8888')).toBe(
        '5511999998888',
      );
    });
    it('mantém DDI quando já presente', () => {
      expect(WhatsappService.normalizePhone('+55 11 99999-8888')).toBe(
        '5511999998888',
      );
    });
    it('rejeita telefone muito curto', () => {
      expect(() => WhatsappService.normalizePhone('123')).toThrow(/too short/);
    });
  });

  it('modo mock retorna id mock quando ZAPI_* ausente', async () => {
    const service = await build({ NODE_ENV: 'test' });
    const result = await service.sendInfractionAlert({
      infraction: baseInfraction(),
      phone: '11999998888',
    });
    expect(result.id).toMatch(/^mock-/);
  });

  it('chama Z-API com URL e headers corretos quando configurado', async () => {
    const service = await build({
      NODE_ENV: 'test',
      ZAPI_INSTANCE_ID: 'inst1',
      ZAPI_TOKEN: 'tok1',
      ZAPI_CLIENT_TOKEN: 'ct1',
    });
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ messageId: 'wa-123' }),
    });
    (global as any).fetch = fetchMock;
    const result = await service.sendInfractionAlert({
      infraction: baseInfraction(),
      phone: '11999998888',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.z-api.io/instances/inst1/token/tok1/send-text',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Client-Token': 'ct1',
          'Content-Type': 'application/json',
        }),
      }),
    );
    const body = JSON.parse((fetchMock.mock.calls[0][1] as any).body as string);
    expect(body.phone).toBe('5511999998888');
    expect(body.message).toContain('João');
    expect(body.message).toContain('A-101');
    expect(body.message).toContain('Condo Alpha');
    expect(result.id).toBe('wa-123');
  });

  it('propaga erro quando Z-API retorna não-ok', async () => {
    const service = await build({
      NODE_ENV: 'production',
      ZAPI_INSTANCE_ID: 'inst1',
      ZAPI_TOKEN: 'tok1',
      ZAPI_CLIENT_TOKEN: 'ct1',
    });
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: jest.fn().mockResolvedValue('upstream error'),
    });
    await expect(
      service.sendInfractionAlert({
        infraction: baseInfraction(),
        phone: '11999998888',
      }),
    ).rejects.toThrow(/HTTP 500/);
  });
});
