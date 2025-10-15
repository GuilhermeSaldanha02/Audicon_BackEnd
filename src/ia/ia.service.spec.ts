import { Test, TestingModule } from '@nestjs/testing';
import { IaService } from './ia.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { InternalServerErrorException } from '@nestjs/common';

jest.mock('axios');

describe('IaService', () => {
  let service: IaService;
  let config: { get: jest.Mock };

  beforeEach(async () => {
    config = {
      get: jest.fn((key: string) => {
        if (key === 'NODE_ENV') return 'test';
        if (key === 'GEMINI_API_KEY') return undefined;
        return undefined;
      }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [IaService, { provide: ConfigService, useValue: config }],
    }).compile();

    service = module.get<IaService>(IaService);
    (axios.post as jest.Mock).mockReset();
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
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('chama API quando há chave e processa JSON limpo', async () => {
    // Configurar para ter chave de API
    config.get.mockImplementation((key: string) => {
      if (key === 'NODE_ENV') return 'test';
      if (key === 'GEMINI_API_KEY') return 'apikey123';
      return undefined;
    });

    (axios.post as jest.Mock).mockResolvedValue({
      data: {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: '```json\n{"descricao_formal":"Texto","penalidade_sugerida":"Advertência"}\n```',
                },
              ],
            },
          },
        ],
      },
    });

    const infraction: any = { description: 'Uso indevido de vaga.' };
    const result = await service.analisarInfracao(infraction);
    expect(axios.post).toHaveBeenCalled();
    expect(result.descricao_formal).toBe('Texto');
    expect(result.penalidade_sugerida).toBe('Advertência');
  });

  it('retorna fallback quando API falha em não-produção', async () => {
    config.get.mockImplementation((key: string) => {
      if (key === 'NODE_ENV') return 'test';
      if (key === 'GEMINI_API_KEY') return 'apikey123';
      return undefined;
    });

    (axios.post as jest.Mock).mockRejectedValue(new Error('fail'));

    const result = await service.analisarInfracao({
      description: 'Porta quebrada.',
    } as any);
    expect(result.descricao_formal).toContain('Relato formal');
    expect(result.formalDescription).toContain('Formal report');
  });

  it('lança erro em produção sem API key', async () => {
    config.get.mockImplementation((key: string) => {
      if (key === 'NODE_ENV') return 'production';
      if (key === 'GEMINI_API_KEY') return undefined;
      return undefined;
    });

    await expect(
      service.analisarInfracao({ description: 'Teste' } as any),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('lança erro em produção quando API falha', async () => {
    config.get.mockImplementation((key: string) => {
      if (key === 'NODE_ENV') return 'production';
      if (key === 'GEMINI_API_KEY') return 'apikey123';
      return undefined;
    });

    (axios.post as jest.Mock).mockRejectedValue(new Error('fail'));

    await expect(
      service.analisarInfracao({ description: 'Teste' } as any),
    ).rejects.toThrow(InternalServerErrorException);
  });
});
