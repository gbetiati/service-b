import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
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
import type { ScriptContext } from '@/modules/content/domain/providers/script.provider';
import { ProductAdAudio, ProductAdCopy, ProductAdPolicy, ProductAdVoiceClip } from '../../domain/entities/product-ad';
import { alignVoiceLines } from '../../domain/entities/voice-alignment';
import type { RenderBrand, RenderProduct } from '../../domain/entities/video-generation.entity';
import { CopyContext, CopyWriterProvider } from '../../domain/providers/copy-writer.provider';
import { SpeechProvider } from '../../domain/providers/speech.provider';
import { TranscriptionProvider } from '../../domain/providers/transcription.provider';
import { RenderRequest, VideoProvider } from '../../domain/providers/video.provider';
import type { ContentAudio } from '@/modules/content/domain/entities/content.entity';
import { VoiceClipTools } from '../remotion/voice-clip.tools';
import { PRODUCT_AD_MUSIC_TRACKS, PRODUCT_AD_TEMPLATES, productAdCompositionId } from '../remotion/product-ad.compositions';
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
// Os clipes da locução ficam no bucket só durante o render; a URL assinada precisa durar a fila e o render.
const VOICE_URL_TTL_SECONDS = 7200;
// Reels do Instagram.
const format = '9x16';

type AdSource = { script: string; context: ScriptContext; product: RenderProduct; brand: RenderBrand; imageUrl: string; audio?: ContentAudio };
type Voiceover = { clips: NonNullable<ProductAdAudio['voiceover']>; keys: string[]; transcript: string };

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
    private readonly speechProvider: SpeechProvider,
    private readonly voiceClips: VoiceClipTools,
    private readonly transcriptionProvider: TranscriptionProvider,
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

  async render ({ submissionId, script, imageUrls, brand, context, product, audio }: RenderRequest) {
    // TESTE (mock): validação comentada.
    // requiredEnv('REMOTION_WEBHOOK_SECRET');

    if (!product) throw new AppError('invalid', 'A geração não tem os dados do produto. Solicite um novo vídeo.');

    if (!imageUrls.length) throw new AppError('invalid', 'Associe ao menos uma foto real do produto ao conteúdo.');

    const providerId = providerPrefix + randomUUID();
    setImmediate(() => {
      this.process(submissionId, providerId, { script, context, product, brand, imageUrl: imageUrls[0], audio })
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
      const { storageKey, template, transcript } = await this.produce(providerId, source);
      event = { submissionId, providerId, status: 'succeeded', storageKey, template, ...(transcript && { transcript }) };
      this.logger.log(`Render do Remotion concluído. providerId=${providerId}`);
    } catch (error) {
      this.logger.warn(`Render do Remotion falhou. providerId=${providerId} erro=${describe(error)}`);
      event = { submissionId, providerId, status: 'failed' };
    }
    await this.webhookClient.send(event);
  }

  private async produce (providerId: string, source: AdSource) {
    const { product, brand, imageUrl, context } = source;
    const copy = this.validateCopy(await this.adCopy(source));
    const palette = ProductAdPolicy.pickPalette(brand, this.randomFor(providerId));
    // Sorteio separado do das cores, para a paleta de um render continuar a mesma com qualquer lista de templates.
    const template = PRODUCT_AD_TEMPLATES[Math.floor(this.randomFor(providerId + ':template')() * PRODUCT_AD_TEMPLATES.length)];
    const musicTrack = source.audio?.backgroundMusic ? PRODUCT_AD_MUSIC_TRACKS[Math.floor(this.randomFor(providerId + ':music')() * PRODUCT_AD_MUSIC_TRACKS.length)] : undefined;
    this.logger.log(`Variação do anúncio. providerId=${providerId} template=${template} principal=${palette.primaryColor ?? 'padrão'} secundária=${palette.secondaryColor ?? 'nenhuma'} música=${musicTrack ?? 'não'} locução=${source.audio?.voiceover ? 'sim' : 'não'}`);
    // Sem cor principal cadastrada, usa a cor padrão configurada (REMOTION_PRIMARY_COLOR).
    const primaryColor = palette.primaryColor ?? this.settings.primaryColor;
    const storageKey = this.outputKey(providerId);

    return withTemporaryDirectory('service-b-remotion-', async directory => {
      const voiceover = source.audio?.voiceover ? await this.voiceover(providerId, copy, context.voiceTone, directory) : undefined;
      try {
        const audio: ProductAdAudio = { ...(musicTrack && { musicTrack }), ...(voiceover && { voiceover: voiceover.clips }) };
        const props = ProductAdPolicy.buildProps({ product, copy, imageUrl, primaryColor, secondaryColor: palette.secondaryColor, audio });
        await this.semaphore.run(async () => {
          const outputPath = join(directory, 'output.mp4');
          await this.renderer.render({ compositionId: productAdCompositionId(format, template), props, outputPath, timeoutMs: this.settings.renderTimeoutMs });
          const output = createReadStream(outputPath);
          try {
            await this.storageProvider.put(storageKey, output, 'video/mp4');
          } finally {
            output.destroy();
          }
        });
      } finally {
        if (voiceover) await Promise.all(voiceover.keys.map(key => this.storageProvider.remove(key).catch(() => this.logger.warn(`Não foi possível remover um clipe da locução. key=${key}`))));
      }
      return { storageKey, template, transcript: voiceover?.transcript };
    });
  }

  // Locução do roteiro: um clipe por trecho (gancho, cada benefício e chamada), para o template começar cada fala
  // quando o texto correspondente aparece. Cada clipe é medido e publicado no bucket com URL assinada para o render.
  private async voiceover (providerId: string, copy: ProductAdCopy, voiceTone: string | undefined, directory: string): Promise<Voiceover> {
    const lines = [copy.headline, ...copy.bullets, copy.cta];
    const style = voiceTone ? { style: voiceTone } : {};
    const paths = await this.recordTake(lines, style, directory).catch(error => {
      this.logger.warn(`Locução em tomada única descartada; gravando trecho a trecho. providerId=${providerId} motivo=${describe(error)}`);
      return this.recordLines(lines, style, directory);
    });
    const id = providerId.slice(providerPrefix.length);
    const keys = lines.map((_, index) => `${outputPrefix}${id}-voice-${index}.mp3`);
    // allSettled: se um envio falhar, os outros terminam antes da limpeza, e nenhum clipe fica esquecido no bucket.
    const clips = await settleAll(paths.map(async (path, index): Promise<ProductAdVoiceClip> => {
      const durationInSeconds = await this.voiceClips.seconds(path);
      await this.storageProvider.put(keys[index], await readFile(path), 'audio/mpeg');
      return { src: await this.storageProvider.url(keys[index], VOICE_URL_TTL_SECONDS), durationInSeconds };
    })).catch(async error => {
      await Promise.all(keys.map(key => this.storageProvider.remove(key).catch(() => undefined)));
      throw error;
    });
    return { clips: { hook: clips[0], benefits: clips.slice(1, -1), cta: clips[clips.length - 1] }, keys, transcript: lines.join('\n') };
  }

  // Tomada única: o roteiro inteiro numa chamada, para a voz manter entonação e timbre de uma frase para outra. A
  // transcrição confere se cada trecho foi falado e aponta a pausa onde cortar; qualquer divergência descarta a tomada.
  private async recordTake (lines: string[], style: { style?: string }, directory: string) {
    const take = join(directory, 'voice-take.wav');
    await writeFile(take, await this.speechProvider.synthesize({ text: lines.map(sentence).join('\n'), ...style }));
    const [words, silences] = await Promise.all([this.transcriptionProvider.transcribe({ audio: await readFile(take), language: 'pt' }), this.voiceClips.silences(take)]);
    const alignment = alignVoiceLines(lines, words, silences);

    if (!alignment.ok) throw new AppError('upstream', `A locução não confere com o roteiro: ${alignment.reason}.`);

    const { cuts } = alignment;
    return settleAll(lines.map(async (_, index) => {
      const path = join(directory, `voice-${index}.mp3`);
      await this.voiceClips.tighten(take, path, { start: cuts[index - 1] ?? 0, ...(index < cuts.length && { end: cuts[index] }) });
      return path;
    }));
  }

  // Um clipe por trecho, cada um numa chamada. Reserva para quando a tomada única não pode ser conferida.
  private async recordLines (lines: string[], style: { style?: string }, directory: string) {
    return settleAll(lines.map(async (text, index) => {
      const raw = join(directory, `voice-${index}-raw.wav`);
      const path = join(directory, `voice-${index}.mp3`);
      await writeFile(raw, await this.speechProvider.synthesize({ text, ...style }));
      await this.voiceClips.tighten(raw, path);
      return path;
    }));
  }

  // Um roteiro no formato de cenas (o que o Claude gera) vira a copy diretamente. Qualquer outro roteiro
  // (OpenAI ou editado à mão) é condensado pelo copy writer, junto com os dados do produto e o tom da marca.
  private async adCopy ({ script, context, product, brand }: AdSource): Promise<ProductAdCopy> {
    const scenes = parseAdScript(script);

    if (scenes) return { headline: scenes.hook, bullets: scenes.benefits, cta: scenes.callToAction };

    const { voiceTone, targetAudience, copyGuidelines } = context;
    const copyBrief: CopyContext = {
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

// Fecha cada trecho com pontuação, para o TTS fazer a pausa que separa um trecho do outro na tomada única.
function sentence (line: string) {
  const text = line.trim();
  return /[.!?…]$/.test(text) ? text : text + '.';
}

// Como Promise.all, mas espera todas as tarefas terminarem antes de falhar: nada continua rodando depois da limpeza.
async function settleAll<T> (tasks: Promise<T>[]) {
  const results = await Promise.allSettled(tasks);
  const failure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');

  if (failure) throw failure.reason;

  return results.map(result => (result as PromiseFulfilledResult<T>).value);
}

// Remove URLs (podem ser assinadas) e limita o tamanho antes de logar.
function describe (error: unknown) {
  const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return text.replace(/https?:\/\/\S+/g, '[url]').slice(0, 300);
}
