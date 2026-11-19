import { Injectable } from '@nestjs/common';
import { ContentCatalogService } from '@/modules/content/application/services/content-catalog.service';
import { Content } from '@/modules/content/domain/entities/content.entity';
import { ScriptBrief, ScriptProvider } from '@/modules/content/domain/providers/script.provider';
import { ContentRepository } from '@/modules/content/domain/repositories/content.repository';
import { MediaAssetRepository } from '@/modules/media-asset/domain/repositories/media-asset.repository';
import { AppError, requireRecord } from '@/shared/core/errors/app.error';
import { StorageProvider } from '@/shared/libs/storage/storage.provider';
import { VideoGeneration } from '../../domain/entities/video-generation.entity';
import { VideoProvider } from '../../domain/providers/video.provider';
import { VideoGenerationRepository } from '../../domain/repositories/video-generation.repository';

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
  ) { }

  async execute(input: string | { content: Content; brief: ScriptBrief }) {
    const content = typeof input === 'string'
      ? requireRecord(await this.contentRepository.findById(input), 'Conteúdo')
      : input.content;
    const contentId = content.id;

    const existing = await this.videoGenerationRepository.findCurrent(contentId, content.revision);

    if (existing && existing.status !== 'FAILED') return this.submit(existing);

    const { assets, aiScript } = content.fields;

    if (!assets.length) throw new AppError('invalid', 'Associe ao menos uma foto real do produto ao conteúdo.');

    const [brief, images] = await Promise.all([
      typeof input === 'string' ? this.contentCatalogService.resolve(content) : input.brief,
      this.mediaAssetRepository.findByIds(assets.map(asset => asset.mediaAssetId)),

    ]);

    const imageKeys = assets.map(asset =>
      requireRecord(images.find(image => image.id === asset.mediaAssetId), 'Imagem').storageKey);

    const script = aiScript || await this.scriptProvider.generate(brief);

    const generation = await this.videoGenerationRepository.create(contentId, content.revision, { script, imageKeys, brief });

    return this.submit(generation);
  }

  private async submit(generation: VideoGeneration) {
    const job = generation.status === 'PENDING' && await this.videoGenerationRepository.claimSubmission(generation);
    let { status } = generation;
    if (job) {
      let providerId: string;
      try {
        const imageUrls = await Promise.all(job.input.imageKeys.map(key => this.storageProvider.url(key, 7200)));
        providerId = await this.videoProvider.render({ submissionId: job.submissionId, script: job.input.script, imageUrls });
      } catch {
        await this.videoGenerationRepository.fail(job, 'Falha ao solicitar o render. Confirme a configuração e o template.');
        return { id: job.id, contentId: job.contentId, revision: job.revision, status: 'FAILED' as const };
      }
      await this.videoGenerationRepository.submitted(job, providerId);
      status = 'RENDERING';
    }
    return { id: generation.id, contentId: generation.contentId, revision: generation.revision, status };
  }
}
