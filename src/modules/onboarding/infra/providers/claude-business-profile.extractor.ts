import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { requiredEnv } from '@/shared/core/config';
import { AppError } from '@/shared/core/errors/app.error';
import { BusinessProfileExtractor, BusinessSources } from '../../domain/providers/business-profile-extractor';
import { ProfileSchema, SYSTEM_PROMPT, USER_PROMPT, toFindings } from './business-profile.prompt';

// Perfil da empresa e da marca principal pelo Claude, com saída estruturada (schema validado).
@Injectable()
export class ClaudeBusinessProfileExtractor implements BusinessProfileExtractor {
  private readonly logger = new Logger(ClaudeBusinessProfileExtractor.name);
  private client?: Anthropic;

  constructor(
    private readonly config: ConfigService,
  ) {}

  private get anthropic () {
    return this.client ??= new Anthropic({ apiKey: requiredEnv('ANTHROPIC_API_KEY'), timeout: 90_000, maxRetries: 1 });
  }

  async extract (sources: BusinessSources) {
    const model = this.config.get<string>('ANTHROPIC_MODEL')?.trim() || 'claude-sonnet-5-5';
    const fallbacks = this.config.get<string>('ANTHROPIC_FALLBACKS')?.trim() !== 'off';

    let response;
    try {
      response = await this.anthropic.beta.messages.parse({
        model,
        max_tokens: 6000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: USER_PROMPT(sources) }],
        output_config: { effort: 'medium', format: betaZodOutputFormat(ProfileSchema) },
        ...(fallbacks && { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }),
      });
    } catch (error) {
      if (error instanceof Anthropic.APIError) {
        this.logger.warn(`Claude API respondeu com erro. status=${error.status ?? 'n/a'} requestId=${error.requestID ?? 'n/a'}`);
        throw new AppError('upstream', 'A análise do negócio falhou. Tente novamente.');
      }
      this.logger.warn(`Perfil do Claude fora do schema. erro=${error instanceof Error ? error.name : 'desconhecido'}`);
      throw new AppError('upstream', 'A análise do negócio veio num formato inesperado.');
    }

    if (response.stop_reason === 'refusal') throw new AppError('upstream', 'A IA recusou analisar esse conteúdo.');

    const parsed = ProfileSchema.safeParse(response.parsed_output);

    if (response.stop_reason === 'max_tokens' || !parsed.success) throw new AppError('upstream', 'A análise do negócio veio incompleta.');

    return toFindings(parsed.data);
  }
}
