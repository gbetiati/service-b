import { Injectable, Logger } from '@nestjs/common';
import { GenerateVideoUseCase } from '@/modules/video-generation/application/use-cases/generate-video.usecase';
import { AppError } from '@/shared/core/errors/app.error';
import { PublicationExecutionReader } from '../ports/publication-execution-reader';
import { PublicationPolicy } from '../../domain/entities/publication.policy';
import { PublicationPhase, PublicationRepository } from '../../domain/repositories/publication.repository';
import { PublishScheduledContentUseCase } from './publish-scheduled-content.usecase';

@Injectable()
export class PublicationOrchestrator {
  private readonly logger = new Logger(PublicationOrchestrator.name);

  constructor(
    private readonly publicationRepository: PublicationRepository,
    private readonly generateVideoUseCase: GenerateVideoUseCase,
    private readonly publishScheduledContentUseCase: PublishScheduledContentUseCase,
    private readonly publicationExecutionReader: PublicationExecutionReader,
  ) {}

  async execute (id: string, phase: PublicationPhase) {
    const job = await this.publicationRepository.reserveForProcessing(id, phase);
    console.log('JOBB', job)
    if (!job) return;

    const { credential, schedule } = job;

    if (!credential || !PublicationPolicy.canPublishWithCredential(job.accountActive, credential, schedule.date, Date.now())) {
      return this.publicationRepository.markFailed(job, 'A conta precisa ter uma credencial ativa para publicar.');
    }

    const { video, approved, scriptStatus, videoStatus } = await this.publicationExecutionReader.readPreparationState(job);

    if (phase === 'publication') {
      // if (scriptStatus !== 'READY' || videoStatus !== 'READY') return this.publicationRepository.releaseProcessing(job);

      // if (!video || !approved) {
      //   return this.publicationRepository.markFailed(job, 'Use um vídeo aprovado da revisão atual do conteúdo.');
      // }
      if(!video) {
        console.log('SEM VIDEO')
        return
      }
      if (!schedule.videoId) await this.publicationRepository.attachApprovedVideo(job, video.id);


      console.log('INDO PUBLICAR...', job, video.storageKey, credential)
    //      return this.publishScheduledContentUseCase.execute(job, video.storageKey, credential);
    }

    if (!PublicationPolicy.isWithinGraceWindow(schedule.date, Date.now())) {
      return this.publicationRepository.markFailed(job, 'O prazo expirou antes de o vídeo ficar pronto.');
    }

    if (scriptStatus === 'FAILED') return this.publicationRepository.markFailed(job, 'Não foi possível gerar o roteiro.');

    if (videoStatus === 'FAILED') return this.publicationRepository.markFailed(job, 'Não foi possível renderizar o vídeo.');

    const requestScript = scriptStatus === 'NOT_STARTED';
    const requestVideo = scriptStatus === 'READY' && videoStatus === 'NOT_STARTED';

    if (requestScript || requestVideo) {
      const failureMessage = requestScript ? 'Não foi possível solicitar o roteiro.' : 'Não foi possível solicitar o render.';
      const input = { companyId: job.companyId, contentId: schedule.contentId };
      let generation: Awaited<ReturnType<GenerateVideoUseCase['requestVideo']>>;

      try {
        generation = requestScript ? await this.generateVideoUseCase.requestScript(input) : await this.generateVideoUseCase.requestVideo(input);
      } catch (error) {
        this.logger.warn(`Falha na preparação da publicação ${job.id}.`);
        return this.publicationRepository.markFailed(job, error instanceof AppError ? error.message : failureMessage);
      }

      if (generation.status === 'FAILED') return this.publicationRepository.markFailed(job, failureMessage);
    }

    return this.publicationRepository.releaseProcessing(job);
  }
}
