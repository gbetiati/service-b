import { Injectable } from '@nestjs/common';
import { CompleteScriptGenerationUseCase } from '@/modules/video-generation/application/use-cases/complete-script-generation.usecase';
import { PublicationRepository } from '../../domain/repositories/publication.repository';

@Injectable()
export class HandleScriptCompletedUseCase {
  constructor(
    private readonly completeScriptGenerationUseCase: CompleteScriptGenerationUseCase,
    private readonly publicationRepository: PublicationRepository,
  ) {}

  async execute (responseId: string) {
    const generation = await this.completeScriptGenerationUseCase.execute(responseId);

    if (generation) {
      await this.publicationRepository.resumeForContent(generation.companyId, generation.contentId, generation.revision);
    }
  }
}
