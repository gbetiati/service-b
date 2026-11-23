import { Readable } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { Injectable } from '@nestjs/common';
import { requiredEnv, servicePublicUrl } from '@/shared/core/config';
import { AppError } from '@/shared/core/errors/app.error';
import { ExternalApiProvider } from '@/shared/libs/http/external-api.provider';
import { VideoProvider } from '../../domain/providers/video.provider';

const model = 'minimax/h3-lite';
const predictionsUrl = `https://api.replicate.com/v1/models/${model}/predictions`;
const maxBytes = 250 * 1024 * 1024;

@Injectable()
export class ReplicateH3LiteProvider implements VideoProvider {
  constructor(private readonly externalApiProvider: ExternalApiProvider) { }

  async render({ submissionId, script, imageUrls }: Parameters<VideoProvider['render']>[0]) {
    const webhook = servicePublicUrl('/webhooks/replicate');
    if (webhook.protocol !== 'https:') {
      throw new AppError('unavailable', 'A URL pública do serviço precisa usar HTTPS para o webhook da Replicate.');
    }

    requiredEnv('REPLICATE_WEBHOOK_SECRET');
    webhook.searchParams.set('submissionId', submissionId);

    if (imageUrls.length > 9) throw new AppError('invalid', 'H3 Lite aceita até nove imagens de referência.');

    const prediction = await this.externalApiProvider.json<{ id?: unknown } | null>(predictionsUrl, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + requiredEnv('REPLICATE_API_TOKEN'), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: {
          prompt: script, 
          reference_image_urls: imageUrls,
          ratio: '9:16',
          duration: 12,
          resolution: '768P'
        },
        webhook: webhook.toString(),
        webhook_events_filter: ['completed'],
      }),
    });

    if (typeof prediction?.id !== 'string' || !prediction.id) {
      throw new AppError('upstream', 'Replicate não identificou o render solicitado.');
    }

    return this.providerId(prediction.id);
  }

  providerId(predictionId: string) {
    return `replicate:${predictionId}`;
  }

  async download(source: string): Promise<Readable> {
    const url = new URL(source);
    const allowedHost = url.hostname === 'replicate.delivery' || url.hostname.endsWith('.replicate.delivery');

    if (url.protocol !== 'https:' || url.port || url.username || url.password || !allowedHost) {
      throw new AppError('upstream', 'Host de mídia da Replicate não autorizado.');
    }

    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(120_000) });

    if (!response.ok || !response.body || Number(response.headers.get('content-length')) > maxBytes) {
      await response.body?.cancel();
      throw new AppError('upstream', 'Arquivo da Replicate inválido ou acima de 250 MB.');
    }

    const body = Readable.fromWeb(response.body as NodeReadableStream<Uint8Array>);
    return Readable.from(this.limit(body));
  }

  private async *limit(body: Readable) {
    let total = 0;
    for await (const chunk of body) {
      total += chunk.length;
      if (total > maxBytes) throw new AppError('upstream', 'Arquivo da Replicate acima de 250 MB.');
      yield chunk as Buffer;
    }
  }
}
