import { Injectable, Logger } from '@nestjs/common';
import { StorageProvider } from '@/shared/libs/storage/storage.provider';
import type { RenderInput } from '../../domain/entities/video-generation.entity';
import { VideoAsset, type VideoReview } from '../../domain/entities/video-asset.entity';
import { RenderResult, VideoProvider } from '../../domain/providers/video.provider';
import { VideoReviewProvider } from '../../domain/providers/video-review.provider';
import { VideoGenerationRepository } from '../../domain/repositories/video-generation.repository';

@Injectable()
export class CompleteVideoGenerationUseCase {
  private readonly logger = new Logger(CompleteVideoGenerationUseCase.name);

  constructor(
    private readonly videoGenerationRepository: VideoGenerationRepository,
    private readonly videoProvider: VideoProvider,
    private readonly videoReviewProvider: VideoReviewProvider,
    private readonly storageProvider: StorageProvider,
  ) {}

  async execute (renderResult: RenderResult, download: VideoProvider['download'] = url => this.videoProvider.download(url)) {
    const result = await this.videoGenerationRepository.claimCompletion(renderResult);

    if (!result) return null;

    const { generation, claimed } = result;

    const context = `generationId=${generation.id} renderId=${renderResult.providerId}`;

    if (!claimed) {
      this.logger.log(`Webhook já processado. ${context} status=${generation.status}`);
      return generation;
    }

    const { outcome } = renderResult;
    this.logger.log(`Webhook de render recebido. ${context} resultado=${outcome.state}`);

    try {
      if (outcome.state === 'failed') {
        await this.videoGenerationRepository.fail(generation, 'O provedor rejeitou o render.');
        this.logger.warn(`Render rejeitado pelo provedor. ${context}`);
      } else {
        const { companyId, contentId, id, revision, input } = generation;
        const key = VideoAsset.storageKeyFor(companyId, contentId, id);
        try {
          await this.storageProvider.put(key, await download(outcome.url), 'video/mp4');
        } catch {
          await this.videoGenerationRepository.fail(generation, 'Falha ao baixar ou salvar o vídeo.');
          this.logger.warn(`Falha ao baixar ou salvar o MP4. ${context}`);
          return generation;
        }

        this.logger.log(`MP4 salvo no storage. ${context}`);
        const review = await this.review(key, input);
        await this.videoGenerationRepository.complete(generation, new VideoAsset(id, companyId, contentId, id, revision, key, review), outcome.narrated ?? true);
        this.logger.log(`Processamento do render concluído. ${context} revisão=${review.status}`);
      }

      return generation;
    } catch (error) {
      this.logger.warn(`Falha ao concluir o webhook do render. ${context}`);
      await this.videoGenerationRepository.release(generation);
      throw error;
    }
  }

  private async review (key: string, input: RenderInput): Promise<VideoReview> {
    // TESTE (mock): revisão automática comentada; todo vídeo é aprovado.
    return VideoAsset.skippedReview();
    // if (process.env.VIDEO_REVIEW_ENABLED === 'false') return VideoAsset.skippedReview();
    //
    // const references = await Promise.all(input.imageKeys.map(image => this.storageProvider.url(image)));
    // return this.videoReviewProvider.review(await this.storageProvider.open(key), input, references);
  }
}
