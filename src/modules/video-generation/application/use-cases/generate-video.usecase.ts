import { Injectable } from '@nestjs/common';
import { ContentCatalogService } from '@/modules/content/application/services/content-catalog.service';
import { ContentRepository } from '@/modules/content/domain/repositories/content.repository';
import { MediaAssetRepository } from '@/modules/media-asset/domain/repositories/media-asset.repository';
import { AppError, requireRecord } from '@/shared/core/errors/app.error';
import { VideoGenerationRepository } from '../../domain/repositories/video-generation.repository';

@Injectable()
export class GenerateVideoUseCase {
  constructor(
    private readonly contentRepository: ContentRepository,
    private readonly contentCatalogService: ContentCatalogService,
    private readonly mediaAssetRepository: MediaAssetRepository,
    private readonly videoGenerationRepository: VideoGenerationRepository,
  ) { }

  async execute(contentId: string)
  {
    const content = requireRecord(await this.contentRepository.findById(contentId), 'Conteúdo');
    const { assets, aiScript } = content.fields;

    if (!assets.length) throw new AppError('invalid', 'Associe ao menos uma foto real do produto ao conteúdo.');

    const [brief, images] = await Promise.all([this.contentCatalogService.resolve(content), this.mediaAssetRepository.findByIds(assets.map(asset => asset.mediaAssetId))]);

    const imageKeys = assets.map(asset =>
      requireRecord(images.find(image => image.id === asset.mediaAssetId), 'Imagem'
      ).storageKey);

    const generation = await this.videoGenerationRepository.create(
      contentId,
      content.revision,
      {
        script: aiScript,
        imageKeys,
        brief
      });

    return { id: generation.id, contentId, revision: generation.revision, status: generation.status };
  }
}
