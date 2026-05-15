import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Infraction } from 'src/infractions/entities/infraction.entity';
import {
  geminiConfigError,
  geminiTimeoutError,
  geminiUpstreamError,
} from './errors';
import { loadPromptTemplate } from './prompts/load-prompt';

const PROMPT_FILE = 'analyze-infraction.v1.md';

@Injectable()
export class IaService implements OnModuleInit {
  private readonly logger = new Logger(IaService.name);
  private genAI: any;
  private model: any;
  private apiKey: string | undefined;
  private nodeEnv: string;
  private geminiApiEndpoint: string;
  private geminiModel: string;
  private timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('GEMINI_API_KEY');
    this.nodeEnv = this.configService.get<string>('NODE_ENV') || 'development';
    this.geminiApiEndpoint =
      this.configService.get<string>('GEMINI_API_ENDPOINT') ??
      'https://generativelanguage.googleapis.com/v1';
    this.geminiModel =
      this.configService.get<string>('GEMINI_MODEL') ?? 'gemini-1.5-pro';
    this.timeoutMs =
      this.configService.get<number>('GEMINI_TIMEOUT_MS') ?? 15000;
  }

  async onModuleInit() {
    this.logger.log(
      `Ambiente: ${this.nodeEnv} | Endpoint: ${this.geminiApiEndpoint} | Modelo: ${this.geminiModel} | Timeout: ${this.timeoutMs}ms`,
    );
    if (this.apiKey) {
      try {
        const mod = await (eval(
          'import("@google/generative-ai")',
        ) as Promise<any>);
        const GenAIClass =
          mod.GoogleGenerativeAI ??
          mod.default?.GoogleGenerativeAI ??
          mod.default;
        this.genAI = new GenAIClass(this.apiKey, {
          apiEndpoint: this.geminiApiEndpoint,
        });
        this.model = this.genAI.getGenerativeModel({ model: this.geminiModel });
        this.logger.log(
          `Cliente Gemini AI inicializado (modelo: ${this.geminiModel}).`,
        );
      } catch (err) {
        this.logger.error(
          'Falha ao importar/inicializar @google/generative-ai:',
          err instanceof Error ? err.message : (err as any),
        );
        if (this.nodeEnv === 'production') {
          throw geminiConfigError();
        }
      }
    } else {
      this.logger.warn(
        'GEMINI_API_KEY ausente. Operando em modo mock (apenas dev/test).',
      );
      if (this.nodeEnv === 'production') {
        throw geminiConfigError();
      }
    }
  }

  async analisarInfracao(infraction: Infraction): Promise<{
    descricao_formal?: string;
    penalidade_sugerida?: string;
    formalDescription?: string;
    suggestedPenalty?: string;
  }> {
    if (!this.apiKey) {
      if (this.nodeEnv === 'production') {
        throw geminiConfigError();
      }
      this.logger.warn(
        'Usando resposta mock de IA (dev/test, sem GEMINI_API_KEY).',
      );
      return this.getFallbackResponse(infraction);
    }

    if (!this.model) {
      if (this.nodeEnv === 'production') {
        throw geminiConfigError();
      }
      return this.getFallbackResponse(infraction);
    }

    const prompt = loadPromptTemplate(PROMPT_FILE, {
      description: infraction.description,
    });

    let rawText: string;
    try {
      rawText = await this.callGeminiWithTimeout(prompt);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Falha na chamada ao Gemini: ${message}`);
      if (this.nodeEnv === 'production') {
        if (message === 'GEMINI_TIMEOUT') {
          throw geminiTimeoutError(this.timeoutMs);
        }
        throw geminiUpstreamError(message);
      }
      return this.getFallbackResponse(infraction);
    }

    const cleaned = rawText
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();
    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      const message =
        parseErr instanceof Error ? parseErr.message : String(parseErr);
      this.logger.warn(`Falha ao parsear JSON do Gemini: ${message}`);
      if (this.nodeEnv === 'production') {
        throw geminiUpstreamError(`Invalid JSON from Gemini: ${message}`);
      }
      return this.getFallbackResponse(infraction);
    }

    return {
      descricao_formal: parsed.descricao_formal,
      penalidade_sugerida: parsed.penalidade_sugerida,
      formalDescription: parsed.descricao_formal,
      suggestedPenalty: parsed.penalidade_sugerida,
    };
  }

  private async callGeminiWithTimeout(prompt: string): Promise<string> {
    const generation = (async () => {
      const result = await this.model.generateContent(prompt);
      const text = result?.response?.text?.() ?? '';
      return text as string;
    })();

    let timeoutId: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error('GEMINI_TIMEOUT')),
        this.timeoutMs,
      );
    });

    try {
      return await Promise.race([generation, timeout]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
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
}
