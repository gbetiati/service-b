import { Readable } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { Injectable } from '@nestjs/common';
import { requiredEnv } from '@/shared/core/config';
import { AppError } from '@/shared/core/errors/app.error';
import { ExternalApiProvider } from '@/shared/libs/http/external-api.provider';
import { VideoProvider } from '../../domain/providers/video.provider';

const api = 'https://api.creatomate.com/v2/renders';
const maxBytes = 250 * 1024 * 1024;

@Injectable()
export class CreatomateProvider implements VideoProvider {
  constructor(
    private readonly externalApiProvider: ExternalApiProvider,
  ) { }

  async render (input: { submissionId: string; script: string; imageUrls: string[] }) {
    const modifications: Record<string, string> = { [requiredEnv('CREATOMATE_SCRIPT_ELEMENT')]: input.script };
    
    const imageElements = requiredEnv('CREATOMATE_IMAGE_ELEMENTS').split(',').map(name => name.trim()).filter(Boolean);

    if (imageElements.length < input.imageUrls.length) throw new AppError('unavailable', 'O template não tem campos de imagem suficientes.');

    input.imageUrls.forEach((url, index) => {
      modifications[imageElements[index]] = url;
    });

    const webhookUrl = new URL(requiredEnv('CREATOMATE_WEBHOOK_URL'));

    if (webhookUrl.protocol !== 'https:') throw new AppError('unavailable', 'CREATOMATE_WEBHOOK_URL precisa usar HTTPS.');

    webhookUrl.searchParams.set('token', requiredEnv('CREATOMATE_WEBHOOK_SECRET'));

    const result = await this.externalApiProvider.json<{ id?: string } | { id?: string }[]>(api, {
      method: 'POST', headers: this.headers(),
      body: JSON.stringify({ template_id: requiredEnv('CREATOMATE_TEMPLATE_ID'), output_format: 'mp4', modifications, webhook_url: webhookUrl.toString(), metadata: input.submissionId }),
    });

    const render = Array.isArray(result) ? result[0] : result;

    if (!render?.id) throw new AppError('upstream', 'Creatomate não identificou o render solicitado.');

    return render.id;
  }

  async download (source: string): Promise<Readable> {
    const url = new URL(source);
    const hosts = (process.env.CREATOMATE_ASSET_HOSTS || 'cdn.creatomate.com').split(',').map(host => host.trim());
    
    if (url.protocol !== 'https:' || url.port || url.username || url.password || !hosts.includes(url.hostname)) {
      throw new AppError('upstream', 'Host de mídia do render não autorizado.');
    }
    
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(120_000) });
    
    if (!response.ok || !response.body || Number(response.headers.get('content-length')) > maxBytes) {
      await response.body?.cancel();
      throw new AppError('upstream', 'Arquivo de render inválido ou acima de 250 MB.');
    }

    const body = Readable.fromWeb(response.body as NodeReadableStream<Uint8Array>);
    return Readable.from(this.limit(body));
  }

  private async *limit (body: Readable) {
    let total = 0;
    for await (const chunk of body) {
      total += chunk.length;

      if (total > maxBytes) throw new AppError('upstream', 'Arquivo de render acima de 250 MB.');

      yield chunk as Buffer;
    }
  }

  private headers () {
    return { Authorization: 'Bearer ' + requiredEnv('CREATOMATE_API_KEY'), 'Content-Type': 'application/json' };
  }
}
