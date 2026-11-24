import { Injectable } from '@nestjs/common';
import { ContentRepository } from '@/modules/content/domain/repositories/content.repository';
import { requireRecord } from '@/shared/core/errors/app.error';
import { StorageProvider } from '@/shared/libs/storage/storage.provider';
import { VideoGenerationRepository } from '../../domain/repositories/video-generation.repository';

@Injectable()
export class GetVideoGenerationStatusUseCase {
  constructor(
    private readonly videoGenerationRepository: VideoGenerationRepository,
    private readonly storageProvider: StorageProvider,
    private readonly contentRepository: ContentRepository,
  ) {}

  async executeForContent (contentId: string) {
    const { revision } = requireRecord(await this.contentRepository.findById(contentId), 'Conteúdo');
    const { id } = requireRecord(await this.videoGenerationRepository.findCurrent(contentId, revision), 'Render');
    return this.execute(id);
  }

  async execute (id: string) {
    const { generation, video, captionedStorageKey } = requireRecord(await this.videoGenerationRepository.findById(id), 'Render');
    const { contentId, revision, status, error, createdAt, updatedAt } = generation;
    return {
      id, contentId, revision, status, error, createdAt, updatedAt,
      video: video && {
        id: video.id,
        review: video.review,
        url: await this.storageProvider.url(video.storageKey),
        captionedUrl: captionedStorageKey ? await this.storageProvider.url(captionedStorageKey) : null,
      },
    };
  }
}
