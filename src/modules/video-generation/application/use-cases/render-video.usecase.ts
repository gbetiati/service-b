import { Injectable } from '@nestjs/common';
import { StorageProvider } from '@/shared/libs/storage/storage.provider';
import { VideoAsset } from '../../domain/entities/video-asset.entity';
import { VideoGeneration } from '../../domain/entities/video-generation.entity';
import { VideoProvider } from '../../domain/providers/video.provider';
import { VideoReviewProvider } from '../../domain/providers/video-review.provider';
import { VideoGenerationRepository } from '../../domain/repositories/video-generation.repository';

@Injectable()
export class RenderVideoUseCase {
  constructor(
    private readonly videoGenerationRepository: VideoGenerationRepository,
    private readonly videoProvider: VideoProvider,
    private readonly videoReviewProvider: VideoReviewProvider,
    private readonly storageProvider: StorageProvider,
  ) {}

  async execute()
  {
    const job = await this.videoGenerationRepository.claim();
    if (!job) return;
    if (job.status === 'SUBMITTING') {
      await this.videoGenerationRepository.fail(job, 'A confirmação do envio para renderização expirou.');
    } else if (job.status === 'PENDING') {
      await this.submit(job);
    } else {
      await this.poll(job);
    }
  }

  private async submit(job: VideoGeneration)
  {
    let providerId: string;
    try {
      const imageUrls = await Promise.all(job.input.imageKeys.map(key => this.storageProvider.url(key, 7200)));
      providerId = await this.videoProvider.render({ script: job.input.script, imageUrls });
    } catch {
      await this.videoGenerationRepository.fail(job, 'Falha ao solicitar o render. Confirme a configuração e o template.');
      return;
    }
    await this.videoGenerationRepository.submitted(job, providerId);
  }

  private async poll(job: VideoGeneration)
  {
    if (!job.providerId || Date.now() - job.createdAt.getTime() > 2 * 60 * 60 * 1000) {
      await this.videoGenerationRepository.fail(job, 'O prazo de renderização ou revisão expirou.');
      return;
    }
    try {
      const result = await this.videoProvider.status(job.providerId);
      if (result.state === 'pending') return await this.videoGenerationRepository.postpone(job, 10_000);
      if (result.state === 'failed') return await this.videoGenerationRepository.fail(job, 'O provedor rejeitou o render.');
      const key = `${job.companyId}/contents/${job.contentId}/videos/${job.id}.mp4`;
      await this.storageProvider.put(key, await this.videoProvider.download(result.url), 'video/mp4');
      const references = await Promise.all(job.input.imageKeys.map(image => this.storageProvider.url(image)));
      const review = await this.videoReviewProvider.review(await this.storageProvider.open(key), job.input, references);
      await this.videoGenerationRepository.complete(job, new VideoAsset(job.id, job.companyId, job.contentId, job.id, job.revision, key, review));
    } catch {
      await this.videoGenerationRepository.postpone(job, 60_000);
    }
  }
}
