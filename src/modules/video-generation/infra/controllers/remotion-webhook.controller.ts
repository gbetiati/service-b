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
import { PRODUCT_AD_TEMPLATES } from '../remotion/product-ad.compositions';

type RemotionEvent = { submissionId?: unknown; providerId?: unknown; status?: unknown; storageKey?: unknown; template?: unknown; transcript?: unknown };

// A locução sai do roteiro (gancho, até 4 benefícios e chamada), então o texto falado é curto.
const MAX_TRANSCRIPT_LENGTH = 2000;

@Controller('webhooks/remotion')
export class RemotionWebhookController {
  constructor(
    private readonly completeVideoGenerationUseCase: CompleteVideoGenerationUseCase,
    private readonly remotionVideoProvider: RemotionVideoProvider,
  ) {}

  @Post()
  @HttpCode(204)
  async receive (@Req() request: RawBodyRequest<Request>) {
    const { submissionId, providerId, status, storageKey, template, transcript } = this.verifiedEvent(request);

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

    // Transcrição e legendas são dispensadas: o texto já aparece na tela. Com locução, o texto falado (que é o
    // próprio roteiro) vira a transcrição do conteúdo, sem precisar transcrever o áudio.
    const spoken = typeof transcript === 'string' && transcript.trim() ? transcript.slice(0, MAX_TRANSCRIPT_LENGTH) : undefined;
    // O template entra no nome do arquivo; só vale um dos registrados.
    const known = PRODUCT_AD_TEMPLATES.find(name => name === template);
    await this.completeVideoGenerationUseCase.execute(
      { ...render, outcome: { state: 'ready', url: storageKey, narrated: false, ...(spoken && { transcript: spoken }), ...(known && { template: known }) } },
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
