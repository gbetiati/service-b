import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { requiredEnv } from '@/shared/core/config';
import { AppError } from '@/shared/core/errors/app.error';
import { BusinessProfileExtractor, BusinessSources } from '../../domain/providers/business-profile-extractor';
import { ProfileSchema, SYSTEM_PROMPT, USER_PROMPT, toFindings } from './business-profile.prompt';

const RESPONSES_URL = 'https://api.openai.com/v1/responses';
const REQUEST_TIMEOUT_MS = 90_000;

type Fetch = typeof fetch;
type ResponsesBody = {
  status?: string;
  incomplete_details?: { reason?: string } | null;
  output?: { type?: string; content?: { type?: string; text?: string; refusal?: string }[] }[];
  error?: { code?: string; type?: string } | null;
};

// JSON Schema para o modo estrito dos Structured Outputs: sem "$schema" e sem maxLength (não aceito no modo estrito;
// os limites de texto são aplicados depois, em toFindings).
export function strictSchema () {
  const strip = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(strip);
    if (!node || typeof node !== 'object') return node;
    return Object.fromEntries(Object.entries(node).filter(([key]) => key !== '$schema' && key !== 'maxLength').map(([key, value]) => [key, strip(value)]));
  };
  return strip(z.toJSONSchema(ProfileSchema)) as Record<string, unknown>;
}

// Perfil da empresa e da marca principal pela OpenAI (Responses API com Structured Outputs no modo estrito: a resposta
// segue o schema). Modelo em OPENAI_ONBOARDING_MODEL, ou OPENAI_MODEL.
@Injectable()
export class OpenAiBusinessProfileExtractor implements BusinessProfileExtractor {
  private readonly logger = new Logger(OpenAiBusinessProfileExtractor.name);
  protected fetch: Fetch = (input, init) => fetch(input, init);

  constructor(
    private readonly config: ConfigService,
  ) {}

  async extract (sources: BusinessSources) {
    const model = this.config.get<string>('OPENAI_ONBOARDING_MODEL')?.trim() || this.config.get<string>('OPENAI_MODEL')?.trim() || 'gpt-4.1-mini';

    let response: Response;
    try {
      response = await this.fetch(RESPONSES_URL, {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: { authorization: `Bearer ${requiredEnv('OPENAI_API_KEY')}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model,
          instructions: SYSTEM_PROMPT,
          input: USER_PROMPT(sources),
          max_output_tokens: 6000,
          text: { format: { type: 'json_schema', name: 'business_profile', strict: true, schema: strictSchema() } },
        }),
      });
    } catch {
      throw new AppError('upstream', 'Falha na comunicação com a IA da análise do negócio.');
    }

    const body = await response.json().catch(() => ({})) as ResponsesBody;

    if (!response.ok) {
      // Só os códigos do erro vão para o log, nunca o corpo inteiro.
      this.logger.warn(`OpenAI respondeu com erro. status=${response.status} code=${body.error?.code ?? body.error?.type ?? 'n/a'} requestId=${response.headers.get('x-request-id') ?? 'n/a'}`);
      throw new AppError('upstream', response.status === 429 ? 'A IA recusou por limite de uso ou falta de créditos.' : 'A análise do negócio falhou. Tente novamente.');
    }

    const content = body.output?.flatMap(item => item.type === 'message' ? item.content ?? [] : []) ?? [];

    if (content.some(part => part.type === 'refusal')) throw new AppError('upstream', 'A IA recusou analisar esse conteúdo.');

    if (body.status === 'incomplete') throw new AppError('upstream', 'A análise do negócio veio incompleta.');

    const text = content.find(part => part.type === 'output_text')?.text;
    let json: unknown;
    try {
      json = JSON.parse(text ?? '');
    } catch {
      throw new AppError('upstream', 'A análise do negócio veio num formato inesperado.');
    }

    const parsed = ProfileSchema.safeParse(json);

    if (!parsed.success) {
      this.logger.warn('Perfil da OpenAI fora do schema.');
      throw new AppError('upstream', 'A análise do negócio veio num formato inesperado.');
    }

    return toFindings(parsed.data);
  }
}
