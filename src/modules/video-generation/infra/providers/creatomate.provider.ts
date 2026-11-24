import type { Readable } from 'node:stream';
import { Injectable, Logger } from '@nestjs/common';
import { httpsWebhookUrl, requiredEnv } from '@/shared/core/config';
import { AppError } from '@/shared/core/errors/app.error';
import { ExternalApiProvider } from '@/shared/libs/http/external-api.provider';
import { downloadLimited, isPlainHttpsUrl } from '@/shared/libs/http/limited-download';
import { VideoProvider } from '../../domain/providers/video.provider';

const api = 'https://api.creatomate.com/v2/renders';
const maxBytes = 250 * 1024 * 1024;

@Injectable()
export class CreatomateProvider implements VideoProvider {
  private readonly logger = new Logger(CreatomateProvider.name);

  constructor(
    private readonly externalApiProvider: ExternalApiProvider,
  ) {}

  async render (input: { submissionId: string; script: string; imageUrls: string[] }) {
    const modifications = this.modifications(input.script, input.imageUrls);
    const webhookUrl = httpsWebhookUrl('/webhooks/creatomate', 'do Creatomate');
    webhookUrl.searchParams.set('token', requiredEnv('CREATOMATE_WEBHOOK_SECRET'));

    this.logger.log(`Solicitando render MP4 ao Creatomate. submissionId=${input.submissionId} imagens=${input.imageUrls.length}`);
    const result = await this.externalApiProvider.json<{ id?: string } | { id?: string }[]>(api, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        template_id: requiredEnv('CREATOMATE_TEMPLATE_ID'), output_format: 'mp4', modifications,
        webhook_url: webhookUrl.toString(), metadata: input.submissionId,
      }),
    });
    const render = Array.isArray(result) ? result[0] : result;

    if (!render?.id) throw new AppError('upstream', 'Creatomate não identificou o render solicitado.');

    this.logger.log(`Render aceito pelo Creatomate. submissionId=${input.submissionId} renderId=${render.id}`);
    return render.id;
  }

  async download (source: string): Promise<Readable> {
    const url = new URL(source);
    const hosts = (process.env.CREATOMATE_ASSET_HOSTS || 'cdn.creatomate.com').split(',').map(host => host.trim());

    if (!isPlainHttpsUrl(url) || !hosts.includes(url.hostname)) throw new AppError('upstream', 'Host de mídia do render não autorizado.');

    return downloadLimited(url, {
      maxBytes, timeoutMs: 120_000,
      invalidMessage: 'Arquivo de render inválido ou acima de 250 MB.', oversizedMessage: 'Arquivo de render acima de 250 MB.',
    });
  }

  // Preenche os campos dinâmicos do template: o roteiro e as fotos na ordem informada.
  private modifications (script: string, imageUrls: string[]) {
    const modifications: Record<string, string> = { [requiredEnv('CREATOMATE_SCRIPT_ELEMENT')]: script };
    const imageElements = requiredEnv('CREATOMATE_IMAGE_ELEMENTS').split(',').map(name => name.trim()).filter(Boolean);

    if (imageElements.length < imageUrls.length) throw new AppError('unavailable', 'O template não tem campos de imagem suficientes.');

    imageUrls.forEach((url, index) => {
      modifications[imageElements[index]] = url;
    });
    return modifications;
  }

  private headers () {
    return { Authorization: 'Bearer ' + requiredEnv('CREATOMATE_API_KEY'), 'Content-Type': 'application/json' };
  }
}
