import { Readable } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { Injectable } from '@nestjs/common';
import { requiredEnv } from '@/shared/core/config';
import { AppError } from '@/shared/core/errors/app.error';
import { ExternalApiProvider } from '@/shared/libs/http/external-api.provider';
import { RenderStatus, VideoProvider } from '../../domain/providers/video.provider';

const api = 'https://api.creatomate.com/v2/renders';
const maxBytes = 250 * 1024 * 1024;

@Injectable()
export class CreatomateProvider implements VideoProvider {
  constructor(
    private readonly http: ExternalApiProvider,
  ) { }

  async render(input: { script: string; imageUrls: string[] })
  {
    const modifications: Record<string, string> = { [requiredEnv('CREATOMATE_SCRIPT_ELEMENT')]: input.script };
    
    const imageElements = requiredEnv('CREATOMATE_IMAGE_ELEMENTS').split(',').map(name => name.trim()).filter(Boolean);

    if (imageElements.length < input.imageUrls.length) throw new AppError('unavailable', 'O template não tem campos de imagem suficientes.');

    input.imageUrls.forEach((url, index) => { modifications[imageElements[index]] = url; });

    const result = await this.http.json<{ id?: string; warnings?: string[] }[]>(api, {
      method: 'POST', headers: this.headers(),
      body: JSON.stringify({ template_id: requiredEnv('CREATOMATE_TEMPLATE_ID'), output_format: 'mp4', modifications }),
    });

    if (!result[0]?.id || result[0].warnings?.length) throw new AppError('upstream', 'Creatomate não aceitou o template enviado.');
    return result[0].id;
  }

  async status(id: string): Promise<RenderStatus>
  {
    const render = await this.http.json<{ status: string; url?: string }>(api + '/' + encodeURIComponent(id), { headers: this.headers() });
    
    if (render.status === 'succeeded' && render.url) return { state: 'ready', url: render.url };
    
    if (render.status === 'failed') return { state: 'failed' };
    
    return { state: 'pending' };
  }

  async download(source: string): Promise<Readable>
  {
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

  private async *limit(body: Readable)
  {
    let total = 0;
    for await (const chunk of body) {
      total += chunk.length;
      if (total > maxBytes) throw new AppError('upstream', 'Arquivo de render acima de 250 MB.');
      yield chunk as Buffer;
    }
  }
  private headers()
  { return { Authorization: 'Bearer ' + requiredEnv('CREATOMATE_API_KEY'), 'Content-Type': 'application/json' }; }
}
