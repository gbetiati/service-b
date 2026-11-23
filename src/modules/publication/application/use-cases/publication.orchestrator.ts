import { Injectable, Logger } from '@nestjs/common';
import { GenerateVideoUseCase } from '@/modules/video-generation/application/use-cases/generate-video.usecase';
import { BurnVideoSubtitlesUseCase } from '@/modules/video-generation/application/use-cases/burn-video-subtitles.usecase';
import { TranscribeVideoUseCase } from '@/modules/video-generation/application/use-cases/transcribe-video.usecase';
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
    private readonly transcribeVideoUseCase: TranscribeVideoUseCase,
    private readonly burnVideoSubtitlesUseCase: BurnVideoSubtitlesUseCase,
  ) { }

  async execute(id: string, phase: PublicationPhase) {
    const job = await this.publicationRepository.reserveForProcessing(id, phase);
    console.log('JOBB', job);
    if (!job) return;

    const { credential, schedule } = job;

    if (!credential || !PublicationPolicy.canPublishWithCredential(job.accountActive, credential, schedule.date, Date.now())) {
      return this.publicationRepository.markFailed(job, 'A conta precisa ter uma credencial ativa para publicar.');
    }

    const { video, scriptStatus, videoStatus, transcriptionStatus, subtitleStatus, revision } = await this.publicationExecutionReader.readPreparationState(job);

    if (phase === 'publication') {
      if (!video) {
        console.log('SEM VIDEO');
        return;
      }
      if (!schedule.videoId) await this.publicationRepository.attachApprovedVideo(job, video.id);
      // O envio ao publicador está desativado. O job segue pelas verificações de preparação.
      console.log('INDO PUBLICAR...', job, video.storageKey, credential);
    }

    if (!PublicationPolicy.isWithinGraceWindow(schedule.date, Date.now())) {
      if (transcriptionStatus === 'READY' && subtitleStatus !== 'READY') {
        return this.publicationRepository.markFailed(job, 'O prazo expirou antes de as legendas ficarem prontas.');
      }
      if (videoStatus === 'READY' && transcriptionStatus !== 'READY') {
        return this.publicationRepository.markFailed(job, 'O prazo expirou antes de a transcrição ficar pronta.');
      }
      return this.publicationRepository.markFailed(job, 'O prazo expirou antes de o vídeo ficar pronto.');
    }

    const input = { companyId: job.companyId, contentId: schedule.contentId };
    const steps = [
      {
        status: scriptStatus,
        prerequisitesReady: true,
        request: () => this.generateVideoUseCase.requestScript(input),
        failureMessage: 'Não foi possível gerar o roteiro.',
        requestFailureMessage: 'Não foi possível solicitar o roteiro.',
      },
      {
        status: videoStatus,
        prerequisitesReady: scriptStatus === 'READY',
        request: () => this.generateVideoUseCase.requestVideo(input),
        failureMessage: 'Não foi possível renderizar o vídeo.',
        requestFailureMessage: 'Não foi possível solicitar o render.',
      },
      {
        status: transcriptionStatus,
        prerequisitesReady: scriptStatus === 'READY' && videoStatus === 'READY',
        request: () => this.transcribeVideoUseCase.execute({ ...input, revision }),
        failureMessage: 'Não foi possível transcrever o vídeo.',
        requestFailureMessage: 'Não foi possível solicitar a transcrição.',
      },
      {
        status: subtitleStatus,
        prerequisitesReady: transcriptionStatus === 'READY',
        request: () => this.burnVideoSubtitlesUseCase.execute({ ...input, revision }),
        failureMessage: 'Não foi possível renderizar as legendas.',
        requestFailureMessage: 'Não foi possível preparar o MP4 legendado.',
      },
    ];

    const failedStep = steps.find(({ status }) => status === 'FAILED');
    if (failedStep) return this.publicationRepository.markFailed(job, failedStep.failureMessage);

    const nextStep = steps.find(({ status, prerequisitesReady }) => status === 'NOT_STARTED' && prerequisitesReady);
    if (!nextStep) return this.publicationRepository.releaseProcessing(job);

    const { request, requestFailureMessage } = nextStep;
    let generation: Awaited<ReturnType<typeof request>>;

    try {
      generation = await request();
    } catch (error) {
      this.logger.warn(`Falha na preparação da publicação ${job.id}.`);
      return this.publicationRepository.markFailed(job, error instanceof AppError ? error.message : requestFailureMessage);
    }

    if (generation.status === 'FAILED') {
      return this.publicationRepository.markFailed(job, requestFailureMessage);
    }

    return this.publicationRepository.releaseProcessing(job);
  }
}
