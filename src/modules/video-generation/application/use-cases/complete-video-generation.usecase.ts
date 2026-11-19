import { Injectable } from '@nestjs/common';
import { StorageProvider } from '@/shared/libs/storage/storage.provider';
import { VideoAsset } from '../../domain/entities/video-asset.entity';
import { RenderNotification, VideoProvider } from '../../domain/providers/video.provider';
import { VideoReviewProvider } from '../../domain/providers/video-review.provider';
import { VideoGenerationRepository } from '../../domain/repositories/video-generation.repository';

@Injectable()
export class CompleteVideoGenerationUseCase {
  constructor(
    private readonly videoGenerationRepository: VideoGenerationRepository,
    private readonly videoProvider: VideoProvider,
    private readonly videoReviewProvider: VideoReviewProvider,
    private readonly storageProvider: StorageProvider,
  ) {}

  async execute (notification: RenderNotification) {
    const result = await this.videoGenerationRepository.claimCompletion(notification);

    if (!result) return null;

    const { generation, claimed } = result;

    if (!claimed) return generation;

    const { outcome } = notification;

    try {
      if (outcome.state === 'failed') {
        await this.videoGenerationRepository.fail(generation, 'O provedor rejeitou o render.');
      } else {
        const { companyId, contentId, id, revision, input } = generation;
        const key = `${companyId}/contents/${contentId}/videos/${id}.mp4`;
        await this.storageProvider.put(key, await this.videoProvider.download(outcome.url), 'video/mp4');
        const references = await Promise.all(input.imageKeys.map(image => this.storageProvider.url(image)));
        const review = await this.videoReviewProvider.review(await this.storageProvider.open(key), input, references);
        await this.videoGenerationRepository.complete(generation, new VideoAsset(id, companyId, contentId, id, revision, key, review));
      }

      return generation;
    } catch (error) {
      await this.videoGenerationRepository.release(generation);
      throw error;
    }
  }
}
