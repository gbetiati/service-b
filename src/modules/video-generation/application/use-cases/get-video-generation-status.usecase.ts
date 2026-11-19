import { Injectable } from '@nestjs/common';
import { requireRecord } from '@/shared/core/errors/app.error';
import { StorageProvider } from '@/shared/libs/storage/storage.provider';
import { VideoGenerationRepository } from '../../domain/repositories/video-generation.repository';

@Injectable()
export class GetVideoGenerationStatusUseCase {
  constructor(
    private readonly videoGenerationRepository: VideoGenerationRepository,
    private readonly storageProvider: StorageProvider,
  ) {}

  async execute (id: string) {
    const { generation, video } = requireRecord(await this.videoGenerationRepository.findById(id), 'Render');
    const { contentId, revision, status, error, createdAt, updatedAt } = generation;
    return {
      id, contentId, revision, status, error, createdAt, updatedAt,
      video: video && { id: video.id, review: video.review, url: await this.storageProvider.url(video.storageKey) },
    };
  }
}
