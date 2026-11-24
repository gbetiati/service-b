import type { Readable } from 'node:stream';
import { Injectable } from '@nestjs/common';
import { httpsWebhookUrl, requiredEnv } from '@/shared/core/config';
import { AppError } from '@/shared/core/errors/app.error';
import { ExternalApiProvider } from '@/shared/libs/http/external-api.provider';
import { downloadLimited, isPlainHttpsUrl } from '@/shared/libs/http/limited-download';
import { VideoProvider } from '../../domain/providers/video.provider';

const model = 'minimax/h3-lite';
const predictionsUrl = `https://api.replicate.com/v1/models/${model}/predictions`;
const maxBytes = 250 * 1024 * 1024;
const maxReferenceImages = 9;

@Injectable()
export class ReplicateH3LiteProvider implements VideoProvider {
  constructor(
    private readonly externalApiProvider: ExternalApiProvider,
  ) {}

  async render ({ submissionId, script, imageUrls }: Parameters<VideoProvider['render']>[0]) {
    const webhook = httpsWebhookUrl('/webhooks/replicate', 'da Replicate');
    requiredEnv('REPLICATE_WEBHOOK_SECRET');
    webhook.searchParams.set('submissionId', submissionId);

    if (imageUrls.length > maxReferenceImages) throw new AppError('invalid', 'H3 Lite aceita até nove imagens de referência.');

    const prediction = await this.externalApiProvider.json<{ id?: unknown } | null>(predictionsUrl, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + requiredEnv('REPLICATE_API_TOKEN'), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { prompt: script, reference_image_urls: imageUrls, ratio: '9:16', duration: 12, resolution: '768P' },
        webhook: webhook.toString(),
        webhook_events_filter: ['completed'],
      }),
    });

    if (typeof prediction?.id !== 'string' || !prediction.id) throw new AppError('upstream', 'Replicate não identificou o render solicitado.');

    return this.providerId(prediction.id);
  }

  // Prefixa o ID para não colidir com IDs de renders de outros provedores.
  providerId (predictionId: string) {
    return `replicate:${predictionId}`;
  }

  async download (source: string): Promise<Readable> {
    const url = new URL(source);
    const allowedHost = url.hostname === 'replicate.delivery' || url.hostname.endsWith('.replicate.delivery');

    if (!isPlainHttpsUrl(url) || !allowedHost) throw new AppError('upstream', 'Host de mídia da Replicate não autorizado.');

    return downloadLimited(url, {
      maxBytes, timeoutMs: 120_000,
      invalidMessage: 'Arquivo da Replicate inválido ou acima de 250 MB.', oversizedMessage: 'Arquivo da Replicate acima de 250 MB.',
    });
  }
}
