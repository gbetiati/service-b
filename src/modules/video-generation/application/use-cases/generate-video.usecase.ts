import { Injectable } from '@nestjs/common';
import { ContentCatalogService } from '@/modules/content/application/services/content-catalog.service';
import { ScriptProvider } from '@/modules/content/domain/providers/script.provider';
import { ContentRepository } from '@/modules/content/domain/repositories/content.repository';
import { MediaAssetRepository } from '@/modules/media-asset/domain/repositories/media-asset.repository';
import { AppError, requireRecord } from '@/shared/core/errors/app.error';
import { RequestContext } from '@/shared/core/request-context/request-context';
import { StorageProvider } from '@/shared/libs/storage/storage.provider';
import { VideoGeneration } from '../../domain/entities/video-generation.entity';
import { VideoProvider } from '../../domain/providers/video.provider';
import { VideoGenerationRepository } from '../../domain/repositories/video-generation.repository';

type ScheduledGenerationCommand = {
  companyId: string;
  contentId: string;
  mode: 'generate-script' | 'submit-pending';
};

@Injectable()
export class GenerateVideoUseCase {
  constructor(
    private readonly contentRepository: ContentRepository,
    private readonly contentCatalogService: ContentCatalogService,
    private readonly mediaAssetRepository: MediaAssetRepository,
    private readonly videoGenerationRepository: VideoGenerationRepository,
    private readonly scriptProvider: ScriptProvider,
    private readonly videoProvider: VideoProvider,
    private readonly storageProvider: StorageProvider,
    private readonly requestContext: RequestContext,
  ) { }

  execute (contentId: string) {
    return this.generate(contentId, 'manual');
  }

  ensureGenerationStarted ({ companyId, contentId, mode }: ScheduledGenerationCommand) {
    return this.requestContext.runForCompany(companyId, () => this.generate(contentId, mode));
  }

  private async generate (contentId: string, mode: 'manual' | ScheduledGenerationCommand['mode']) {
    const content = requireRecord(await this.contentRepository.findById(contentId), 'Conteúdo');
    const existing = await this.videoGenerationRepository.findCurrent(contentId, content.revision);

    if (existing && existing.status !== 'FAILED') return this.advance(existing);

    if (existing && mode !== 'manual') return this.result(existing);

    if (mode === 'submit-pending') throw new AppError('conflict', 'A geração pendente não foi encontrada na revisão atual.');

    const { assets, aiScript } = content.fields;

    if (!assets.length) throw new AppError('invalid', 'Associe ao menos uma foto real do produto ao conteúdo.');

    const [brief, images] = await Promise.all([
      this.contentCatalogService.resolve(content),
      this.mediaAssetRepository.findByIds(assets.map(asset => asset.mediaAssetId)),
    ]);

    const imageKeys = assets.map(asset =>
      requireRecord(images.find(image => image.id === asset.mediaAssetId), 'Imagem').storageKey);

    const needsScriptWebhook = mode === 'generate-script';
    const script = needsScriptWebhook ? '' : aiScript || await this.scriptProvider.generate(brief);
    const generation = await this.videoGenerationRepository.create(
      contentId, content.revision, { script, imageKeys, brief }, mode === 'manual', needsScriptWebhook ? 'PENDING_SCRIPT' : 'PENDING',
    );

    return this.advance(generation);
  }

  private advance (generation: VideoGeneration) {
    return generation.status === 'PENDING_SCRIPT' ? this.submitScript(generation) : this.submit(generation);
  }

  private async submitScript (generation: VideoGeneration) {
    const job = await this.videoGenerationRepository.claimScriptSubmission(generation);

    if (!job) return this.readSubmissionResult(generation);

    try {
      await this.scriptProvider.request(job.input.brief, job.scriptSubmissionId);
      await this.videoGenerationRepository.scriptSubmitted(job);
    } catch (error) {
      await this.videoGenerationRepository.release(job);
      throw error;
    }

    return this.readSubmissionResult(generation);
  }

  private async submit (generation: VideoGeneration) {
    if (generation.status !== 'PENDING') return this.result(generation);

    const job = await this.videoGenerationRepository.claimSubmission(generation);

    if (job) {
      let providerId: string;
      try {
        const imageUrls = await Promise.all(job.input.imageKeys.map(key => this.storageProvider.url(key, 7200)));
        providerId = await this.videoProvider.render({ submissionId: job.submissionId, script: job.input.script, imageUrls });
      } catch {
        await this.videoGenerationRepository.fail(job, 'Falha ao solicitar o render. Confirme a configuração e o template.');
        return this.readSubmissionResult(job);
      }
      await this.videoGenerationRepository.submitted(job, providerId);
    }

    return this.readSubmissionResult(generation);
  }

  private async readSubmissionResult (generation: VideoGeneration) {
    const current = await this.videoGenerationRepository.findCurrent(generation.contentId, generation.revision);
    return this.result(requireRecord(current, 'Geração'));
  }

  private result ({ id, contentId, revision, status }: VideoGeneration) {
    return { id, contentId, revision, status };
  }
}
