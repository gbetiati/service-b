import { Injectable } from '@nestjs/common';
import { CompleteVideoGenerationUseCase } from '@/modules/video-generation/application/use-cases/complete-video-generation.usecase';
import type { RenderNotification } from '@/modules/video-generation/domain/providers/video.provider';
import { PublicationRepository } from '../../domain/repositories/publication.repository';

@Injectable()
export class HandleVideoRenderCompletedUseCase {
  constructor(
    private readonly completeVideoGenerationUseCase: CompleteVideoGenerationUseCase,
    private readonly publicationRepository: PublicationRepository,
  ) {}

  async execute (notification: RenderNotification) {
    const generation = await this.completeVideoGenerationUseCase.execute(notification);

    if (generation) {
      await this.publicationRepository.resumeForContent(generation.companyId, generation.contentId, generation.revision);
    }
  }
}
