import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { Infracao } from 'src/infracoes/entities/infracao.entity';

@Injectable()
export class IaService {
  private readonly logger = new Logger(IaService.name);

  constructor(private readonly configService: ConfigService) {}

  async analisarInfracao(
    infracao: Infracao,
  ): Promise<{ descricao_formal: string; penalidade_sugerida: string }> {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    const nodeEnv = this.configService.get<string>('NODE_ENV') || 'development';
    // --- PONTO DE LOG 1: VERIFICAR A CHAVE API ---
    this.logger.log(`A usar a chave de API do Gemini que começa com: ${apiKey?.substring(0, 5)}...`);
    if (!apiKey) {
      this.logger.error('A chave da API do Gemini (GEMINI_API_KEY) não foi encontrada no ficheiro .env');
      // Fallback em desenvolvimento
      if (nodeEnv !== 'production') {
        this.logger.warn('Usando resposta mock de IA (desenvolvimento, sem chave GEMINI).');
        return {
          descricao_formal: `Relato formal: ${infracao.descricao}`,
          penalidade_sugerida: 'Advertência',
        };
      }
      throw new InternalServerErrorException('A chave da API do Gemini não foi configurada.');
    }

    const prompt = this.construirPrompt(infracao.descricao);

    const modelName = 'gemini-pro';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    // --- PONTO DE LOG 2: VERIFICAR O URL ---
    this.logger.log(`A enviar requisição para o URL: ${url}`);

    try {
      const response = await axios.post(
        url,
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      this.logger.log('Resposta recebida com sucesso da API do Gemini.');

      const content = response.data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

      // Limpeza para garantir que apenas o JSON seja processado, removendo blocos de código markdown.
      const cleanedJsonString = content.replace(/```json/g, '').replace(/```/g, '').trim();

      return JSON.parse(cleanedJsonString);

    } catch (error) {
      // --- PONTO DE LOG 3: ERRO DETALHADO ---
      this.logger.error("Erro detalhado ao chamar a API do Gemini:", (error as any)?.response?.data || (error as any)?.message);
      // Fallback em desenvolvimento
      if (nodeEnv !== 'production') {
        this.logger.warn('Usando resposta mock de IA (desenvolvimento, falha na API Gemini).');
        return {
          descricao_formal: `Relato formal: ${infracao.descricao}`,
          penalidade_sugerida: 'Advertência',
        };
      }
      throw new InternalServerErrorException('Falha ao analisar a infração com a IA do Gemini.');
    }
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
