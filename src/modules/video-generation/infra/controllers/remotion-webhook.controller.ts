import { Controller, HttpCode, Post, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { isUUID } from 'class-validator';
// TESTE (mock): reative junto com a verificação da assinatura.
// import { Webhook } from 'standardwebhooks';
// import { requiredEnv } from '@/shared/core/config';
// import { standardWebhookHeaders } from '@/shared/libs/http/standard-webhook';
import { AppError } from '@/shared/core/errors/app.error';
import { CompleteVideoGenerationUseCase } from '../../application/use-cases/complete-video-generation.usecase';
import { RemotionVideoProvider } from '../providers/remotion.provider';

type RemotionEvent = { submissionId?: unknown; providerId?: unknown; status?: unknown; storageKey?: unknown };

@Controller('webhooks/remotion')
export class RemotionWebhookController {
  constructor(
    private readonly completeVideoGenerationUseCase: CompleteVideoGenerationUseCase,
    private readonly remotionVideoProvider: RemotionVideoProvider,
  ) {}

  @Post()
  @HttpCode(204)
  async receive (@Req() request: RawBodyRequest<Request>) {
    const { submissionId, providerId, status, storageKey } = this.verifiedEvent(request);

    if (typeof submissionId !== 'string' || !isUUID(submissionId) || typeof providerId !== 'string' || !RemotionVideoProvider.isProviderId(providerId)) {
      throw new AppError('invalid', 'Webhook sem identificação do render.');
    }

    const render = { submissionId, providerId };

    if (status === 'failed') {
      await this.completeVideoGenerationUseCase.execute({ ...render, outcome: { state: 'failed' } });
      return;
    }

    if (status !== 'succeeded') return;

    if (storageKey !== this.remotionVideoProvider.outputKey(providerId)) throw new AppError('invalid', 'Webhook sem o arquivo do vídeo.');

    // O anúncio não tem fala: transcrição e legendas são dispensadas.
    await this.completeVideoGenerationUseCase.execute(
      { ...render, outcome: { state: 'ready', url: storageKey, narrated: false } },
      key => this.remotionVideoProvider.download(key),
    );
    await this.remotionVideoProvider.discard(storageKey);
  }

  private verifiedEvent (request: RawBodyRequest<Request>) {
    const rawBody = request.rawBody;

    if (!rawBody) throw new AppError('invalid', 'Webhook sem corpo.');

    // TESTE (mock): verificação da assinatura comentada; o corpo é lido sem validar.
    return JSON.parse(rawBody.toString('utf8')) as RemotionEvent;
    // const webhook = new Webhook(requiredEnv('REMOTION_WEBHOOK_SECRET'));
    //
    // try {
    //   return (webhook.verify(rawBody, standardWebhookHeaders(request)) ?? {}) as RemotionEvent;
    // } catch {
    //   throw new AppError('unauthorized', 'Webhook não autorizado.');
    // }
  }
}
