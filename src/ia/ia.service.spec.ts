import { Test, TestingModule } from '@nestjs/testing';
import { IaService } from './ia.service';
import { ConfigService } from '@nestjs/config';
import {
  BadGatewayException,
  ServiceUnavailableException,
} from '@nestjs/common';

describe('IaService', () => {
  let service: IaService;
  let config: { get: jest.Mock };

  async function build(env: Record<string, any>) {
    config = {
      get: jest.fn((key: string) => env[key]),
    } as any;
    const module: TestingModule = await Test.createTestingModule({
      providers: [IaService, { provide: ConfigService, useValue: config }],
    }).compile();
    service = module.get<IaService>(IaService);
  }

  beforeEach(async () => {
    await build({ NODE_ENV: 'test', GEMINI_TIMEOUT_MS: 15000 });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('retorna fallback quando sem API key em não-produção', async () => {
    const infraction: any = { description: 'Barulho após horário.' };
    const result = await service.analisarInfracao(infraction);
    expect(result.descricao_formal).toContain('Relato formal');
    expect(result.formalDescription).toContain('Formal report');
    expect(result.penalidade_sugerida).toBeDefined();
    expect(result.suggestedPenalty).toBeDefined();
  });

  it('chama modelo Gemini com prompt renderizado e processa JSON limpo', async () => {
    await build({
      NODE_ENV: 'test',
      GEMINI_API_KEY: 'apikey123',
      GEMINI_TIMEOUT_MS: 15000,
    });
    const mockModel = {
      generateContent: jest.fn().mockResolvedValue({
        response: {
          text: () =>
            '```json\n{"descricao_formal":"Texto","penalidade_sugerida":"Advertência"}\n```',
        },
      }),
    };
    (service as any).model = mockModel;
    (service as any).apiKey = 'apikey123';
    const infraction: any = { description: 'Uso indevido de vaga.' };
    const result = await service.analisarInfracao(infraction);
    expect(mockModel.generateContent).toHaveBeenCalledTimes(1);
    const promptArg = mockModel.generateContent.mock.calls[0][0] as string;
    expect(promptArg).toContain('"Uso indevido de vaga."');
    expect(promptArg).not.toContain('{{description}}');
    expect(result.descricao_formal).toBe('Texto');
    expect(result.penalidade_sugerida).toBe('Advertência');
  });

  it('retorna fallback quando modelo falha em não-produção', async () => {
    await build({
      NODE_ENV: 'test',
      GEMINI_API_KEY: 'apikey123',
      GEMINI_TIMEOUT_MS: 15000,
    });
    const mockModel = {
      generateContent: jest.fn().mockRejectedValue(new Error('fail')),
    };
    (service as any).model = mockModel;
    (service as any).apiKey = 'apikey123';
    const result = await service.analisarInfracao({
      description: 'Porta quebrada.',
    } as any);
    expect(result.descricao_formal).toContain('Relato formal');
    expect(result.formalDescription).toContain('Formal report');
  });

  it('lança ServiceUnavailableException em produção sem API key', async () => {
    await build({
      NODE_ENV: 'production',
      GEMINI_API_KEY: undefined,
      GEMINI_TIMEOUT_MS: 15000,
    });
    (service as any).nodeEnv = 'production';
    (service as any).apiKey = undefined;
    await expect(
      service.analisarInfracao({ description: 'Teste' } as any),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('lança BadGatewayException em produção quando modelo falha', async () => {
    await build({
      NODE_ENV: 'production',
      GEMINI_API_KEY: 'apikey123',
      GEMINI_TIMEOUT_MS: 15000,
    });
    const mockModel = {
      generateContent: jest.fn().mockRejectedValue(new Error('upstream 500')),
    };
    (service as any).model = mockModel;
    (service as any).nodeEnv = 'production';
    (service as any).apiKey = 'apikey123';
    await expect(
      service.analisarInfracao({ description: 'Teste' } as any),
    ).rejects.toThrow(BadGatewayException);
  });

  it('lança BadGatewayException (timeout) em produção quando excede GEMINI_TIMEOUT_MS', async () => {
    await build({
      NODE_ENV: 'production',
      GEMINI_API_KEY: 'apikey123',
      GEMINI_TIMEOUT_MS: 50,
    });
    const mockModel = {
      generateContent: jest.fn().mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () => resolve({ response: { text: () => '{}' } }),
              500,
            ),
          ),
      ),
    };
    (service as any).model = mockModel;
    (service as any).nodeEnv = 'production';
    (service as any).apiKey = 'apikey123';
    (service as any).timeoutMs = 50;
    const err = await service
      .analisarInfracao({ description: 'Teste' } as any)
      .catch((e) => e);
    expect(err).toBeInstanceOf(BadGatewayException);
    expect((err.getResponse() as any).message).toMatch(/timed out/i);
  });

  it('lança BadGatewayException em produção quando JSON é inválido', async () => {
    await build({
      NODE_ENV: 'production',
      GEMINI_API_KEY: 'apikey123',
      GEMINI_TIMEOUT_MS: 15000,
    });
    const mockModel = {
      generateContent: jest.fn().mockResolvedValue({
        response: { text: () => 'not json at all' },
      }),
    };
    (service as any).model = mockModel;
    (service as any).nodeEnv = 'production';
    (service as any).apiKey = 'apikey123';
    const err = await service
      .analisarInfracao({ description: 'Teste' } as any)
      .catch((e) => e);
    expect(err).toBeInstanceOf(BadGatewayException);
  });
});
