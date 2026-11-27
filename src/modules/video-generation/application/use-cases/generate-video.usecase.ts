import { Injectable, Logger } from '@nestjs/common';
import { ScriptProvider } from '@/modules/content/domain/providers/script.provider';
import type { ContentReferences } from '@/modules/content/domain/entities/content.entity';
import { ContentMediaType } from '@/modules/content/domain/entities/content-media-type';
import { ContentRepository } from '@/modules/content/domain/repositories/content.repository';
import { ProductRepository } from '@/modules/product/domain/repositories/product.repository';
import { ImageTemplateSettingRepository } from '@/modules/image-template/domain/repositories/image-template-setting.repository';
import { AppError, requireRecord } from '@/shared/core/errors/app.error';
import { RequestContext } from '@/shared/core/request-context/request-context';
import { StorageProvider } from '@/shared/libs/storage/storage.provider';
import type { AdImageKind } from '../../domain/entities/product-ad';
import { RenderBrand, RenderProduct, VideoGeneration } from '../../domain/entities/video-generation.entity';
import { VideoProvider } from '../../domain/providers/video.provider';
import { VideoGenerationRepository } from '../../domain/repositories/video-generation.repository';
import { PRODUCT_AD_TEMPLATES, VIDEO_AD_TEMPLATES } from '../../infra/remotion/product-ad.compositions';

// A URL das fotos e dos vídeos precisa valer enquanto o render aguarda na fila e executa.
const MEDIA_URL_TTL_SECONDS = 7200;

type GenerationCommand = { companyId: string; contentId: string; revision?: number };

@Injectable()
export class GenerateVideoUseCase {
  private readonly logger = new Logger(GenerateVideoUseCase.name);

  constructor(
    private readonly contentRepository: ContentRepository,
    private readonly videoGenerationRepository: VideoGenerationRepository,
    private readonly scriptProvider: ScriptProvider,
    private readonly videoProvider: VideoProvider,
    private readonly storageProvider: StorageProvider,
    private readonly requestContext: RequestContext,
    private readonly productRepository: ProductRepository,
    private readonly imageTemplateSettings: ImageTemplateSettingRepository,
  ) {}

  // `template` escolhe o template do render; precisa ser do tipo do conteúdo (foto ou vídeo). Omitido, é sorteado.
  execute (contentId: string, template?: string) {
    return this.generate(contentId, 'manual', undefined, template);
  }

  requestScript ({ companyId, contentId, revision }: GenerationCommand) {
    return this.requestContext.runForCompany(companyId, () => this.generate(contentId, 'script', revision));
  }

  requestVideo ({ companyId, contentId, revision }: GenerationCommand) {
    return this.requestContext.runForCompany(companyId, () => this.generate(contentId, 'video', revision));
  }

  private async generate (contentId: string, mode: 'manual' | 'script' | 'video', revision?: number, template?: string) {
    const content = requireRecord(await this.contentRepository.findById(contentId), 'Conteúdo');
    if (revision !== undefined && revision !== content.revision) {
      throw new AppError('conflict', 'A revisão do conteúdo mudou durante a preparação.');
    }

    if (mode === 'video' && (content.scriptStatus !== 'READY' || !content.fields.aiScript.trim())) {
      throw new AppError('conflict', 'O roteiro ainda não está pronto para solicitar o vídeo.');
    }

    const existing = await this.videoGenerationRepository.findCurrent(contentId, content.revision);

    if (existing && mode === 'script') return this.submitScript(existing);

    if (existing && mode === 'video') return this.submit(existing);

    if (existing && existing.status !== 'FAILED') {
      this.logger.log(`Geração existente para a revisão ${content.revision}. generationId=${existing.id} status=${existing.status}`);
      return this.advance(existing);
    }

    const { assets, aiScript, contentMediaType: mediaType } = content.fields;
    const allowed: readonly string[] = mediaType === ContentMediaType.VIDEO ? VIDEO_AD_TEMPLATES : PRODUCT_AD_TEMPLATES;

    if (template && !allowed.includes(template)) {
      throw new AppError('invalid', `O template ${template} não serve para um conteúdo de ${mediaType === ContentMediaType.VIDEO ? 'vídeo' : 'foto'}. Use: ${allowed.join(', ')}.`);
    }
    if (!assets.length) throw new AppError('invalid', `Associe ao menos ${mediaType === ContentMediaType.VIDEO ? 'um vídeo real' : 'uma foto real'} do produto ao conteúdo.`);

    const references = await this.contentRepository.findReferences(content);
    // Também confere se as mídias são do tipo do conteúdo (fotos ou vídeos).
    const context = content.buildScriptContext(references);

    const media = assets.map(asset => requireRecord(references.media.find(item => item.id === asset.mediaAssetId), mediaType === ContentMediaType.VIDEO ? 'Vídeo' : 'Foto'));
    const mediaKeys = media.map(item => item.storageKey);
    // O tipo de cada foto (produto ou pessoa) decide em que cena ela entra, conforme a configuração do template.
    const mediaKinds = mediaType === ContentMediaType.IMAGE ? media.map(item => (item.kind === 'PERSON' ? 'PERSON' : 'PRODUCT') as AdImageKind) : undefined;

    const needsScriptWebhook = mode === 'script';

    const script = needsScriptWebhook ? '' : (aiScript.trim() && aiScript) || await this.scriptProvider.generate(context);
    const product = await this.renderProduct(content.fields.productId);
    const brand = this.renderBrand(references);
    const generation = await this.videoGenerationRepository.create(
      contentId, content.revision, { script, mediaKeys, ...(mediaKinds && { mediaKinds }), mediaType, ...(template && { template }), context, product, brand, audio: content.fields.audio }, mode === 'manual', needsScriptWebhook ? 'PENDING_SCRIPT' : 'PENDING',
    );

    return needsScriptWebhook ? this.submitScript(generation) : this.submit(generation);
  }

  // Dados do produto principal usados pelo template do anúncio.
  private async renderProduct (productId: string): Promise<RenderProduct> {
    const { name, description, price, oldPrice } = requireRecord(await this.productRepository.findById(productId), 'Produto');
    return { name, description, price, oldPrice };
  }

  private renderBrand ({ campaign }: ContentReferences): RenderBrand {
    const brand = requireRecord(campaign?.brand, 'Marca');
    const { name, primaryColor, secondaryColor, tertiaryColor, quaternaryColor, logoStorageKey } = brand;
    return { name, primaryColor, secondaryColor, tertiaryColor, quaternaryColor, ...(logoStorageKey && { logoStorageKey }) };
  }

  private advance (generation: VideoGeneration) {
    return generation.status === 'PENDING_SCRIPT' ? this.submitScript(generation) : this.submit(generation);
  }

  private async submitScript (generation: VideoGeneration) {
    if (generation.status !== 'PENDING_SCRIPT') return this.result(generation);

    const job = await this.videoGenerationRepository.claimScriptSubmission(generation);

    if (!job) return this.readSubmissionResult(generation);

    try {
      await this.scriptProvider.request(job.input.context, job.scriptSubmissionId);
    } catch {
      await this.videoGenerationRepository.fail(job, 'Falha ao solicitar roteiro.', 'script');
      return this.readSubmissionResult(job);
    }

    await this.videoGenerationRepository.scriptSubmitted(job);
    return this.readSubmissionResult(generation);
  }

  private async submit (generation: VideoGeneration) {
    if (generation.status !== 'PENDING') return this.result(generation);

    const job = await this.videoGenerationRepository.claimSubmission(generation);

    if (job) {
      const context = `generationId=${job.id} submissionId=${job.submissionId}`;
      this.logger.log(`Preparando envio do vídeo ao provedor de render. ${context}`);
      let providerId: string;
      try {
        const { script, mediaKeys, mediaKinds, mediaType = ContentMediaType.IMAGE, template, context, product, audio, brand = { name: context.brand, primaryColor: null, secondaryColor: null } } = job.input;
        const mediaUrls = await Promise.all(mediaKeys.map(key => this.storageProvider.url(key, MEDIA_URL_TTL_SECONDS)));
        const logoUrl = brand.logoStorageKey ? await this.storageProvider.url(brand.logoStorageKey, MEDIA_URL_TTL_SECONDS) : undefined;
        // A configuração dos templates é lida na hora do render: vale a versão salva mais recente.
        const imageSlots = mediaType === ContentMediaType.IMAGE ? await this.imageSlots() : undefined;
        providerId = await this.videoProvider.render({ submissionId: job.submissionId, script, mediaUrls, mediaKinds, imageSlots, mediaType, template, brand, logoUrl, context, product, audio });
      } catch {
        await this.videoGenerationRepository.fail(job, 'Falha ao solicitar o render. Confirme a configuração e o template.');
        this.logger.warn(`Falha ao solicitar o render ao provedor. ${context}`);
        return this.readSubmissionResult(job);
      }
      await this.videoGenerationRepository.submitted(job, providerId);
    }

    return this.readSubmissionResult(generation);
  }

  // Tipo de foto preferido em cada cena, por template de foto configurado na empresa.
  private async imageSlots () {
    const settings = await this.imageTemplateSettings.findAll();
    return Object.fromEntries(settings.map(({ template, slotKinds }) => [template, slotKinds.map(kind => kind as AdImageKind)]));
  }

  private async readSubmissionResult (generation: VideoGeneration) {
    const current = await this.videoGenerationRepository.findCurrent(generation.contentId, generation.revision);
    return this.result(requireRecord(current, 'Geração'));
  }

  private result ({ id, contentId, revision, status }: VideoGeneration) {
    return { id, contentId, revision, status };
  }
}
