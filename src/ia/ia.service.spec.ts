import { Test, TestingModule } from '@nestjs/testing';
import { IaService } from './ia.service';
import { ConfigService } from '@nestjs/config';
import { InternalServerErrorException } from '@nestjs/common';
describe('IaService', () => {
    let service: IaService;
    let config: {
        get: jest.Mock;
    };
    beforeEach(async () => {
        config = {
            get: jest.fn((key: string) => {
                if (key === 'NODE_ENV')
                    return 'test';
                if (key === 'GEMINI_API_KEY')
                    return undefined;
                return undefined;
            }),
        } as any;
        const module: TestingModule = await Test.createTestingModule({
            providers: [IaService, { provide: ConfigService, useValue: config }],
        }).compile();
        service = module.get<IaService>(IaService);
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
    it('chama modelo Gemini quando há chave e processa JSON limpo', async () => {
        config.get.mockImplementation((key: string) => {
            if (key === 'NODE_ENV')
                return 'test';
            if (key === 'GEMINI_API_KEY')
                return 'apikey123';
            return undefined;
        });
        const mockModel = {
            model: 'gemini-pro',
            generateContent: jest.fn().mockResolvedValue({
                response: {
                    text: () => '```json\n{"descricao_formal":"Texto","penalidade_sugerida":"Advertência"}\n```',
                },
            }),
        };
        (service as any).model = mockModel;
        (service as any).apiKey = 'apikey123';
        const infraction: any = { description: 'Uso indevido de vaga.' };
        const result = await service.analisarInfracao(infraction);
        expect(mockModel.generateContent).toHaveBeenCalled();
        expect(result.descricao_formal).toBe('Texto');
        expect(result.penalidade_sugerida).toBe('Advertência');
    });
    it('retorna fallback quando modelo falha em não-produção', async () => {
        config.get.mockImplementation((key: string) => {
            if (key === 'NODE_ENV')
                return 'test';
            if (key === 'GEMINI_API_KEY')
                return 'apikey123';
            return undefined;
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
    it('lança erro em produção sem API key', async () => {
        config.get.mockImplementation((key: string) => {
            if (key === 'NODE_ENV')
                return 'production';
            if (key === 'GEMINI_API_KEY')
                return undefined;
            return undefined;
        });
        (service as any).nodeEnv = 'production';
        (service as any).apiKey = undefined;
        await expect(service.analisarInfracao({ description: 'Teste' } as any)).rejects.toThrow(InternalServerErrorException);
    });
    it('lança erro em produção quando modelo falha', async () => {
        config.get.mockImplementation((key: string) => {
            if (key === 'NODE_ENV')
                return 'production';
            if (key === 'GEMINI_API_KEY')
                return 'apikey123';
            return undefined;
        });
        const mockModel = {
            generateContent: jest.fn().mockRejectedValue(new Error('fail')),
        };
        (service as any).model = mockModel;
        (service as any).nodeEnv = 'production';
        (service as any).apiKey = 'apikey123';
        await expect(service.analisarInfracao({ description: 'Teste' } as any)).rejects.toThrow(InternalServerErrorException);
    });
});
