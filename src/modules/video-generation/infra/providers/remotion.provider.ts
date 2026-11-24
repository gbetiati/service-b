import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { join } from 'node:path';
import type { Readable } from 'node:stream';
import { Injectable, Logger } from '@nestjs/common';
// TESTE (mock): reative junto com as validações de configuração.
// import { requiredEnv } from '@/shared/core/config';
import { AppError } from '@/shared/core/errors/app.error';
import { withTemporaryDirectory } from '@/shared/core/fs/temporary-directory';
import { Random, seededRandom } from '@/shared/core/random';
import { StorageProvider } from '@/shared/libs/storage/storage.provider';
import { parseAdScript } from '@/modules/content/domain/entities/ad-script';
import type { ScriptBrief } from '@/modules/content/domain/providers/script.provider';
import { ProductAdCopy, ProductAdPolicy } from '../../domain/entities/product-ad';
import type { RenderBrand, RenderProduct } from '../../domain/entities/video-generation.entity';
import { CopyBrief, CopyWriterProvider } from '../../domain/providers/copy-writer.provider';
import { RenderRequest, VideoProvider } from '../../domain/providers/video.provider';
import { PRODUCT_AD_TEMPLATES, productAdCompositionId } from '../remotion/product-ad.compositions';
import { RemotionCliRenderer } from '../remotion/remotion-cli.renderer';
import { RemotionRenderEvent, RemotionWebhookClient } from '../remotion/remotion-webhook.client';
import { RemotionSettings } from '../remotion/remotion.settings';
import { RenderSemaphore } from '../remotion/render-semaphore';
// TESTE (mock): reative junto com as validações da copy.
// import { CopySchema } from './product-ad-copy.schema';

const providerPrefix = 'remotion:';
const outputPrefix = 'remotion-renders/';
const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const providerIdPattern = new RegExp(`^${providerPrefix}${uuid}$`);
const outputKeyPattern = new RegExp(`^${outputPrefix}${uuid}\\.mp4$`);
// Reels do Instagram.
const format = '9x16';

type AdSource = { script: string; brief: ScriptBrief; product: RenderProduct; brand: RenderBrand; imageUrl: string };

// Monta o anúncio do produto: o Claude escreve a copy, o Remotion renderiza localmente e o MP4 vai para o storage.
// Como a CLI não tem webhook, o fim do render (sucesso ou falha) é avisado por um webhook interno assinado.
@Injectable()
export class RemotionVideoProvider implements VideoProvider {
  private readonly logger = new Logger(RemotionVideoProvider.name);
  // Fonte das variações do anúncio, com o ID do render como semente. Substituível em testes.
  protected randomFor: (seed: string) => Random = seededRandom;

  constructor(
    private readonly copyWriterProvider: CopyWriterProvider,
    private readonly renderer: RemotionCliRenderer,
    private readonly storageProvider: StorageProvider,
    private readonly webhookClient: RemotionWebhookClient,
    private readonly semaphore: RenderSemaphore,
    private readonly settings: RemotionSettings,
  ) {}

  static isProviderId (value: string) {
    return providerIdPattern.test(value);
  }

  // Falha cedo, na inicialização, quando o Remotion é o provedor escolhido sem a configuração necessária.
  assertConfigured () {
    // TESTE (mock): validações de configuração comentadas.
    // requiredEnv('REMOTION_WEBHOOK_SECRET');
    // requiredEnv('ANTHROPIC_API_KEY');
  }

  async render ({ submissionId, script, imageUrls, brand, brief, product }: RenderRequest) {
    // TESTE (mock): validação comentada.
    // requiredEnv('REMOTION_WEBHOOK_SECRET');

    if (!product) throw new AppError('invalid', 'A geração não tem os dados do produto. Solicite um novo vídeo.');

    if (!imageUrls.length) throw new AppError('invalid', 'Associe ao menos uma foto real do produto ao conteúdo.');

    const providerId = providerPrefix + randomUUID();
    setImmediate(() => {
      this.process(submissionId, providerId, { script, brief, product, brand, imageUrl: imageUrls[0] })
        .catch(error => this.logger.error(`Falha inesperada no render do Remotion. providerId=${providerId} erro=${describe(error)}`));
    });
    return providerId;
  }

  outputKey (providerId: string) {
    return outputPrefix + providerId.slice(providerPrefix.length) + '.mp4';
  }

  async download (storageKey: string): Promise<Readable> {
    if (!outputKeyPattern.test(storageKey)) throw new AppError('upstream', 'Arquivo de render do Remotion não autorizado.');

    return this.storageProvider.open(storageKey);
  }

  // Remove o MP4 intermediário depois que a conclusão o copiou para o local definitivo.
  async discard (storageKey: string) {
    if (!outputKeyPattern.test(storageKey)) return;

    await this.storageProvider.remove(storageKey).catch(() => this.logger.warn(`Não foi possível remover o render intermediário. key=${storageKey}`));
  }

  private async process (submissionId: string, providerId: string, source: AdSource) {
    let event: RemotionRenderEvent;
    try {
      event = { submissionId, providerId, status: 'succeeded', storageKey: await this.produce(providerId, source) };
      this.logger.log(`Render do Remotion concluído. providerId=${providerId}`);
    } catch (error) {
      this.logger.warn(`Render do Remotion falhou. providerId=${providerId} erro=${describe(error)}`);
      event = { submissionId, providerId, status: 'failed' };
    }
    await this.webhookClient.send(event);
  }

  private async produce (providerId: string, source: AdSource) {
    const { product, brand, imageUrl } = source;
    const copy = this.validateCopy(await this.adCopy(source));
    const palette = ProductAdPolicy.pickPalette(brand, this.randomFor(providerId));
    // Sorteio separado do das cores, para a paleta de um render continuar a mesma com qualquer lista de templates.
    const template = PRODUCT_AD_TEMPLATES[Math.floor(this.randomFor(providerId + ':template')() * PRODUCT_AD_TEMPLATES.length)];
    this.logger.log(`Variação do anúncio. providerId=${providerId} template=${template} principal=${palette.primaryColor ?? 'padrão'} secundária=${palette.secondaryColor ?? 'nenhuma'}`);
    // Sem cor principal cadastrada, usa a cor padrão configurada (REMOTION_PRIMARY_COLOR).
    const primaryColor = palette.primaryColor ?? this.settings.primaryColor;
    const props = ProductAdPolicy.buildProps({ product, copy, imageUrl, primaryColor, secondaryColor: palette.secondaryColor });
    const storageKey = this.outputKey(providerId);

    await this.semaphore.run(() => withTemporaryDirectory('service-b-remotion-', async directory => {
      const outputPath = join(directory, 'output.mp4');
      await this.renderer.render({ compositionId: productAdCompositionId(format, template), props, outputPath, timeoutMs: this.settings.renderTimeoutMs });
      const output = createReadStream(outputPath);
      try {
        await this.storageProvider.put(storageKey, output, 'video/mp4');
      } finally {
        output.destroy();
      }
    }));
    return storageKey;
  }

  // Um roteiro no formato de cenas (o que o Claude gera) vira a copy diretamente. Qualquer outro roteiro
  // (OpenAI ou editado à mão) é condensado pelo copy writer, junto com os dados do produto e o tom da marca.
  private async adCopy ({ script, brief, product, brand }: AdSource): Promise<ProductAdCopy> {
    const scenes = parseAdScript(script);

    if (scenes) return { headline: scenes.hook, bullets: scenes.benefits, cta: scenes.callToAction };

    const { voiceTone, targetAudience, copyGuidelines } = brief;
    const copyBrief: CopyBrief = {
      name: product.name, description: product.description, brand: brand.name, voiceTone, targetAudience, copyGuidelines, ...(script.trim() && { script }),
    };
    return this.copyWriterProvider.write(copyBrief);
  }

  private validateCopy (copy: ProductAdCopy) {
    // TESTE (mock): validações da copy comentadas.
    return copy;
    // const result = CopySchema.safeParse(copy);
    //
    // if (!result.success) throw new AppError('upstream', 'A copy gerada não respeitou os limites de tamanho.');
    //
    // if (ProductAdPolicy.findCommercialClaim(result.data)) throw new AppError('upstream', 'A copy gerada citou preço, desconto ou condição comercial e foi descartada.');
    //
    // return result.data;
  }
}

// Remove URLs (podem ser assinadas) e limita o tamanho antes de logar.
function describe (error: unknown) {
  const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return text.replace(/https?:\/\/\S+/g, '[url]').slice(0, 300);
}
