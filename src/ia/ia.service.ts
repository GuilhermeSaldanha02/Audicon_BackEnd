import { Injectable, InternalServerErrorException, Logger, OnModuleInit, } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Infraction } from 'src/infractions/entities/infraction.entity';

@Injectable()
export class IaService implements OnModuleInit {
    private readonly logger = new Logger(IaService.name);
    private genAI: any;
    private model: any;
    private apiKey: string | undefined;
    private nodeEnv: string;
    private geminiApiEndpoint: string;
    private geminiModel: string;
    constructor(private readonly configService: ConfigService) {
        this.apiKey = this.configService.get<string>('GEMINI_API_KEY');
        this.nodeEnv = this.configService.get<string>('NODE_ENV') || 'development';
        this.geminiApiEndpoint = this.configService.get<string>('GEMINI_API_ENDPOINT') ?? 'https://generativelanguage.googleapis.com/v1';
        this.geminiModel = this.configService.get<string>('GEMINI_MODEL') ?? 'gemini-1.5-pro';
    }
    async onModuleInit() {
        this.logger.log(`Usando a chave de API do Gemini que começa com: ${this.apiKey?.substring(0, 5)}...`);
        this.logger.log(`Ambiente: ${this.nodeEnv} | Endpoint: ${this.geminiApiEndpoint} | Modelo: ${this.geminiModel}`);
        if (this.apiKey) {
            try {
                const mod = await (eval('import("@google/generative-ai")') as Promise<any>);
                const GenAIClass = mod.GoogleGenerativeAI ?? mod.default?.GoogleGenerativeAI ?? mod.default;
                this.genAI = new GenAIClass(this.apiKey, { apiEndpoint: this.geminiApiEndpoint });
                this.model = this.genAI.getGenerativeModel({ model: this.geminiModel });
                this.logger.log(`Cliente Gemini AI inicializado com sucesso (endpoint: ${this.geminiApiEndpoint}, modelo: ${this.geminiModel}).`);
                
            } catch (err) {
                this.logger.error('Falha ao importar/inicializar @google/generative-ai:', err instanceof Error ? err.message : (err as any));
                if (this.nodeEnv !== 'production' && (err as any)?.stack) {
                    this.logger.debug((err as any).stack);
                }
                if (this.nodeEnv === 'production') {
                    throw new Error('Falha ao inicializar cliente Gemini em produção.');
                }
            }
        } else {
            this.logger.error('A chave da API do Gemini (GEMINI_API_KEY) não foi encontrada no ficheiro .env');
            if (this.nodeEnv === 'production') {
                throw new Error('Chave API do Gemini não configurada para produção.');
            }
        }
    }

    // A função listAvailableModels FOI REMOVIDA

    private getModel(): any {
        if (!this.model) {
            if (this.nodeEnv !== 'production') {
                this.logger.warn('Operando em modo fallback (sem chave API Gemini ou client não inicializado).');
                throw new InternalServerErrorException('Cliente Gemini AI não inicializado devido à falta de API Key ou erro de importação.');
            }
            else {
                throw new InternalServerErrorException('Chave API do Gemini não configurada para produção.');
            }
        }
        return this.model;
    }
    async analisarInfracao(infraction: Infraction): Promise<{
        descricao_formal?: string;
        penalidade_sugerida?: string;
        formalDescription?: string;
        suggestedPenalty?: string;
    }> {
        if (!this.apiKey && this.nodeEnv !== 'production') {
            this.logger.warn('Usando resposta mock de IA (desenvolvimento/teste, sem chave GEMINI).');
            return this.getFallbackResponse(infraction);
        }
        if (!this.apiKey && this.nodeEnv === 'production') {
            this.logger.error('Tentativa de usar IA em produção sem GEMINI_API_KEY configurada.');
            throw new InternalServerErrorException('A chave da API do Gemini não foi configurada.');
        }
        const prompt = this.construirPrompt(infraction.description);
        try {
            const model = this.getModel();
            this.logger.log(`Enviando prompt para o modelo Gemini: ${model?.model}`);
            const result = await model.generateContent(prompt);
            const response = result?.response;
            const text = response?.text?.() ?? '';
            this.logger.log(`Texto bruto recebido do Gemini (len=${text.length}).`);
            this.logger.log('Resposta recebida com sucesso da API do Gemini.');
            const cleanedJsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();
            this.logger.log('JSON limpo (pré-parse), prefixo: ' + cleanedJsonString.slice(0, 80) + '...');
            let parsedResult: any;
            try {
                parsedResult = JSON.parse(cleanedJsonString);
            } catch (parseErr) {
                this.logger.warn('Falha ao parsear JSON do Gemini: ' + (parseErr instanceof Error ? parseErr.message : String(parseErr)));
                if (this.nodeEnv !== 'production') {
                    this.logger.debug('Conteúdo não parseado, prefixo: ' + cleanedJsonString.slice(0, 200));
                }
                return this.getFallbackResponse(infraction);
            }
            return {
                descricao_formal: parsedResult.descricao_formal,
                penalidade_sugerida: parsedResult.penalidade_sugerida,
                formalDescription: parsedResult.descricao_formal,
                suggestedPenalty: parsedResult.penalidade_sugerida,
            };
        } catch (error) { 
            this.logger.error('Erro ao chamar a API do Gemini com o SDK:', error instanceof Error ? error.message : (error as any));
            if ((error as any)?.status || (error as any)?.code) {
                this.logger.error(`Detalhes: status=${(error as any)?.status} code=${(error as any)?.code}`);
            }
            if (this.nodeEnv !== 'production' && (error as any)?.stack) {
                this.logger.debug((error as any).stack); 
            }
            if (this.nodeEnv !== 'production') {
                this.logger.warn('Usando resposta mock de IA (desenvolvimento/teste, falha na API Gemini).');
                return this.getFallbackResponse(infraction);
            }
            throw new InternalServerErrorException('Falha ao analisar a infração com a IA do Gemini.');
        }
    }
    private getFallbackResponse(infraction: Infraction) {
        return {
            descricao_formal: `[Fallback] Relato formal: ${infraction.description}`,
            penalidade_sugerida: 'Advertência',
            formalDescription: `[Fallback] Formal report: ${infraction.description}`,
            suggestedPenalty: 'Warning',
        };
    }
    private construirPrompt(descricaoInformal: string): string {
        return `
      Você é um assistente para uma administradora de condomínios. Sua tarefa é analisar a descrição de uma infração e convertê-la para um formato profissional, além de sugerir uma penalidade.

      A descrição da infração é: "${descricaoInformal}"

      Analise a descrição e retorne APENAS um objeto JSON válido, sem nenhum texto adicional, com a seguinte estrutura:
      {
        "descricao_formal": "Uma descrição detalhada e profissional do ocorrido, baseada na descrição informal.",
        "penalidade_sugerida": "Uma sugestão de penalidade entre 'Notificação', 'Advertência' ou 'Multa', baseada na gravidade do ocorrido."
      }
    `;
    }
}