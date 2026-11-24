import { Controller, HttpCode, Post, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { isUUID } from 'class-validator';
import { Webhook } from 'standardwebhooks';
import { CONTENT_MAX_SCRIPT_LENGTH } from '@/modules/content/domain/entities/content.entity';
import type { ScriptOutcome } from '@/modules/content/domain/providers/script.provider';
import { requiredEnv } from '@/shared/core/config';
import { AppError } from '@/shared/core/errors/app.error';
import { standardWebhookHeaders } from '@/shared/libs/http/standard-webhook';
import { CompleteScriptGenerationUseCase } from '../../application/use-cases/complete-script-generation.usecase';

type ClaudeScriptEvent = { submissionId?: unknown; outcome?: { script?: unknown; error?: unknown } };

// Recebe o aviso interno assinado do ClaudeScriptProvider com o roteiro gerado em background.
@Controller('webhooks/claude-script')
export class ClaudeScriptWebhookController {
  constructor(
    private readonly completeScriptGenerationUseCase: CompleteScriptGenerationUseCase,
  ) {}

  @Post()
  @HttpCode(204)
  async receive (@Req() request: RawBodyRequest<Request>) {
    const { submissionId, outcome } = this.verifiedEvent(request);

    if (typeof submissionId !== 'string' || !isUUID(submissionId)) throw new AppError('invalid', 'Webhook sem identificação do roteiro.');

    await this.completeScriptGenerationUseCase.execute({ submissionId, outcome: this.outcome(outcome) });
  }

  private outcome (outcome: ClaudeScriptEvent['outcome']): ScriptOutcome {
    const script = outcome?.script;

    if (typeof script === 'string' && script.trim() && script.length <= CONTENT_MAX_SCRIPT_LENGTH) return { script };

    if (typeof outcome?.error === 'string' && outcome.error.trim()) return { error: outcome.error.slice(0, 500) };

    throw new AppError('invalid', 'Webhook sem roteiro nem erro.');
  }

  private verifiedEvent (request: RawBodyRequest<Request>) {
    const rawBody = request.rawBody;

    if (!rawBody) throw new AppError('invalid', 'Webhook sem corpo.');

    const webhook = new Webhook(requiredEnv('INTERNAL_WEBHOOK_SECRET'));

    try {
      return (webhook.verify(rawBody, standardWebhookHeaders(request)) ?? {}) as ClaudeScriptEvent;
    } catch {
      throw new AppError('unauthorized', 'Webhook não autorizado.');
    }
  }
}
