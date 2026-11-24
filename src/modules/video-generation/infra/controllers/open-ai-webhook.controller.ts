import { Controller, HttpCode, Post, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { Webhook } from 'standardwebhooks';
import { requiredEnv } from '@/shared/core/config';
import { AppError } from '@/shared/core/errors/app.error';
import { standardWebhookHeaders } from '@/shared/libs/http/standard-webhook';
import { CompleteScriptGenerationUseCase } from '../../application/use-cases/complete-script-generation.usecase';

const scriptEvents = new Set(['response.completed', 'response.failed', 'response.incomplete', 'response.cancelled']);
const responseIdPattern = /^resp_[a-zA-Z0-9_]{1,250}$/;

type OpenAiEvent = { type?: string; data?: { id?: unknown } };

@Controller('webhooks/openai')
export class OpenAiWebhookController {
  constructor(
    private readonly completeScriptGenerationUseCase: CompleteScriptGenerationUseCase,
  ) {}

  @Post()
  @HttpCode(204)
  async receive (@Req() request: RawBodyRequest<Request>) {
    const event = this.verifiedEvent(request);

    if (!event?.type || !scriptEvents.has(event.type)) return;

    const responseId = event.data?.id;

    if (typeof responseId !== 'string' || !responseIdPattern.test(responseId)) {
      throw new AppError('invalid', 'Webhook sem identificação da resposta da IA.');
    }

    await this.completeScriptGenerationUseCase.execute(responseId);
  }

  private verifiedEvent (request: RawBodyRequest<Request>) {
    const rawBody = request.rawBody;

    if (!rawBody) throw new AppError('invalid', 'Webhook sem corpo.');

    const headers = standardWebhookHeaders(request);
    const webhook = new Webhook(requiredEnv('OPENAI_WEBHOOK_SECRET'));

    try {
      return webhook.verify(rawBody, headers) as OpenAiEvent | null;
    } catch {
      throw new AppError('unauthorized', 'Webhook não autorizado.');
    }
  }
}
