import { Injectable } from '@nestjs/common';
import { ContentCatalogService } from '@/modules/content/application/services/content-catalog.service';
import { ScriptProvider } from '@/modules/content/domain/providers/script.provider';
import { ContentRepository } from '@/modules/content/domain/repositories/content.repository';
import { CompleteVideoGenerationUseCase } from '@/modules/video-generation/application/use-cases/complete-video-generation.usecase';
import { GenerateVideoUseCase } from '@/modules/video-generation/application/use-cases/generate-video.usecase';
import { RenderNotification } from '@/modules/video-generation/domain/providers/video.provider';
import { AppError, requireRecord } from '@/shared/core/errors/app.error';
import { RequestContext } from '@/shared/core/request-context/request-context';
import { PUBLICATION_GRACE_MS } from '../../domain/entities/publication-timing';
import { PublicationRepository } from '../../domain/repositories/publication.repository';
import { PublishScheduledContentUseCase } from './publish-scheduled-content.usecase';

@Injectable()
export class OrchestratePublicationUseCase {
  constructor(
    private readonly publicationRepository: PublicationRepository,
    private readonly generateVideoUseCase: GenerateVideoUseCase,
    private readonly completeVideoGenerationUseCase: CompleteVideoGenerationUseCase,
    private readonly publishScheduledContentUseCase: PublishScheduledContentUseCase,
    private readonly requestContext: RequestContext,
    private readonly contentRepository: ContentRepository,
    private readonly contentCatalogService: ContentCatalogService,
    private readonly scriptProvider: ScriptProvider,
  ) { }

  async execute(id: string) {
    const job = await this.publicationRepository.claim(id);
    if (!job) return;

    if (!job.accountActive || !job.credential?.expiresAt || job.credential.expiresAt.getTime() <= Math.max(Date.now(), job.schedule.date.getTime())) {
      return this.publicationRepository.fail(job, 'A conta precisa ter uma credencial ativa para publicar.');
    }

    if (job.video) {
      if (!job.approved) return this.publicationRepository.fail(job, 'Use um vídeo aprovado da revisão atual do conteúdo.');
      if (!job.schedule.videoId) await this.publicationRepository.markReady(job, job.video.id);
      return this.publishScheduledContentUseCase.execute(job, job.video.storageKey, job.credential);
    }

    if (Date.now() >= job.schedule.date.getTime() + PUBLICATION_GRACE_MS) {
      return this.publicationRepository.fail(job, 'O prazo expirou antes de o vídeo ficar pronto.');
    }

    if (job.generationStatus === 'FAILED') return this.publicationRepository.fail(job, 'Não foi possível renderizar o vídeo.');

    if (!job.generationStatus || job.generationStatus === 'PENDING') {
      try {
        const contentId = job.schedule.contentId;
        const generation = await this.requestContext.runForCompany(job.companyId, async () => {
          if (job.generationStatus === 'PENDING') return this.generateVideoUseCase.execute(contentId);
          const content = requireRecord(await this.contentRepository.findById(contentId), 'Conteúdo');
          const brief = await this.contentCatalogService.resolve(content);
          content.fields.aiScript = await this.scriptProvider.generate(brief);
          return this.generateVideoUseCase.execute({ content, brief });
        });
        if (generation.status === 'FAILED') return this.publicationRepository.fail(job, 'Não foi possível solicitar o render.');
      } catch (error) {
        if (error instanceof AppError && ['invalid', 'missing', 'conflict'].includes(error.kind)) {
          return this.publicationRepository.fail(job, error.message);
        }
        await this.publicationRepository.defer(job);
        throw error;
      }
    }

    await this.publicationRepository.waitForVideo(job);
  }

  async renderCompleted(notification: RenderNotification) {
    const generation = await this.completeVideoGenerationUseCase.execute(notification);

    if (generation) {
      await this.publicationRepository.resumeForContent(generation.companyId, generation.contentId, generation.revision);
    }
  }
}
