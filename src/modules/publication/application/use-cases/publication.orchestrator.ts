import { Injectable, Logger } from '@nestjs/common';
import { GenerateVideoUseCase } from '@/modules/video-generation/application/use-cases/generate-video.usecase';
import { AppError } from '@/shared/core/errors/app.error';
import { PublicationExecutionReader } from '../ports/publication-execution-reader';
import { PublicationWork } from '../../domain/entities/publication.entity';
import { PublicationPolicy } from '../../domain/entities/publication.policy';
import { PublicationRepository } from '../../domain/repositories/publication.repository';
import { PublishScheduledContentUseCase } from './publish-scheduled-content.usecase';

@Injectable()
export class PublicationOrchestrator {
  private readonly logger = new Logger(PublicationOrchestrator.name);

  constructor(
    private readonly publicationRepository: PublicationRepository,
    private readonly generateVideoUseCase: GenerateVideoUseCase,
    private readonly publishScheduledContentUseCase: PublishScheduledContentUseCase,
    private readonly publicationExecutionReader: PublicationExecutionReader,
  ) { }

  async execute (id: string) {
    const job = await this.publicationRepository.claim(id);

    if (!job) return;

    const now = Date.now();
    const { credential, schedule } = job;

    if (!credential || !PublicationPolicy.canPublishWithCredential(job.accountActive, credential, schedule.date, now)) {
      return this.publicationRepository.fail(job, 'A conta precisa ter uma credencial ativa para publicar.');
    }

    const { video, approved, generationStatus } = await this.publicationExecutionReader.readVideo(job);
    
    if (video) {
      if (!approved) return this.publicationRepository.fail(job, 'Use um vídeo aprovado da revisão atual do conteúdo.');

      if (!schedule.videoId) await this.publicationRepository.markReady(job, video.id);
    
      return this.publishScheduledContentUseCase.execute(job, video.storageKey, credential);
    }

    switch (PublicationPolicy.nextRenderStep(generationStatus, schedule.date, Date.now())) {
      case 'expire':
        return this.publicationRepository.fail(job, 'O prazo expirou antes de o vídeo ficar pronto.');
      case 'reject-render':
        return this.publicationRepository.fail(job, 'Não foi possível renderizar o vídeo.');
      case 'request-render':
        return this.prepareVideo(job, 'generate-script');
      case 'submit-pending-render':
        return this.prepareVideo(job, 'submit-pending');
      case 'wait-for-video':
        return this.publicationRepository.waitForVideo(job, PublicationPolicy.graceDeadline(schedule.date));
    }
  }

  private async prepareVideo (job: PublicationWork, mode: 'generate-script' | 'submit-pending') {
    let generation: Awaited<ReturnType<GenerateVideoUseCase['ensureGenerationStarted']>>;

    try {
      generation = await this.generateVideoUseCase.ensureGenerationStarted({
        companyId: job.companyId, contentId: job.schedule.contentId, mode,
      });
    } catch (error) {
      if (error instanceof AppError && ['invalid', 'missing', 'conflict'].includes(error.kind)) {
        return this.publicationRepository.fail(job, error.message);
      }

      this.logger.warn(`Reagendando a preparação da publicação ${job.id} após uma falha.`);
      return this.publicationRepository.defer(job);
    }

    if (generation.status === 'FAILED') {
      return this.publicationRepository.fail(job, 'Não foi possível solicitar o render.');
    }

    const canProgress = generation.status === 'PENDING' || generation.status === 'READY';
    const nextAttemptAt = canProgress ? new Date() : PublicationPolicy.graceDeadline(job.schedule.date);
    
    return this.publicationRepository.waitForVideo(job, nextAttemptAt);
  }
}
