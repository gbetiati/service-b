import { Injectable, Logger } from '@nestjs/common';
import { GenerateVideoUseCase } from '@/modules/video-generation/application/use-cases/generate-video.usecase';
import { BurnVideoSubtitlesUseCase } from '@/modules/video-generation/application/use-cases/burn-video-subtitles.usecase';
import { TranscribeVideoUseCase } from '@/modules/video-generation/application/use-cases/transcribe-video.usecase';
import { AppError } from '@/shared/core/errors/app.error';
import { RequestContext } from '@/shared/core/request-context/request-context';
import { ContentPreparationInput, ContentPreparationRepository } from '@/modules/content/domain/repositories/content-preparation.repository';
import { UpdateContentUseCase } from '@/modules/content/application/use-cases/update-content.usecase';
import { PublicationPolicy } from '../../domain/entities/publication.policy';

@Injectable()
export class PublicationOrchestrator {
  private readonly logger = new Logger(PublicationOrchestrator.name);

  constructor(
    private readonly generateVideoUseCase: GenerateVideoUseCase,
    private readonly contentPreparationRepository: ContentPreparationRepository,
    private readonly transcribeVideoUseCase: TranscribeVideoUseCase,
    private readonly burnVideoSubtitlesUseCase: BurnVideoSubtitlesUseCase,
    private readonly requestContext: RequestContext,
    private readonly updateContentUseCase: UpdateContentUseCase,
  ) { }

  async start(contentId: string, regenerateFromRevision?: number) {
    this.logger.log(`Preparação solicitada para o conteúdo ${contentId}.`);

    const input = { companyId: this.requestContext.companyId, contentId };

    if (regenerateFromRevision !== undefined) {
      const content = await this.updateContentUseCase.execute(contentId, { revision: regenerateFromRevision }, true);
      return this.execute(input, content.revision);
    }

    await this.contentPreparationRepository.request(input);
    return this.execute(input);
  }

  async execute(input: ContentPreparationInput, expectedRevision?: number) {
    const {
      revision,
      scriptStatus,
      videoStatus,
      transcriptionStatus,
      subtitleStatus,
      status,
      video
    } = await this.contentPreparationRepository.read(input);

    if (expectedRevision !== undefined && expectedRevision !== revision) {
      throw new AppError('conflict', 'A revisão do conteúdo mudou durante a preparação.');
    }

    this.logger.log(`Conteúdo ${input.contentId}, revisão ${revision}: roteiro=${scriptStatus}, vídeo=${videoStatus}, transcrição=${transcriptionStatus}, legendas=${subtitleStatus}.`,);

    const steps = [
      {
        status: scriptStatus,
        request: () => this.generateVideoUseCase.requestScript({ ...input, revision }),
        failureMessage: 'Não foi possível gerar o roteiro.',
      },
      {
        status: videoStatus,
        request: () => this.generateVideoUseCase.requestVideo({ ...input, revision }),
        failureMessage: 'Não foi possível renderizar o vídeo.',
      },
      {
        status: transcriptionStatus,
        request: () => this.transcribeVideoUseCase.execute({ ...input, revision }),
        failureMessage: 'Não foi possível transcrever o vídeo.',
      },
      {
        status: subtitleStatus,
        request: () => this.burnVideoSubtitlesUseCase.execute({ ...input, revision }),
        failureMessage: 'Não foi possível renderizar as legendas.',
      },
    ];

    const fail = async (error: string) => {
      await this.contentPreparationRepository.complete(input, revision);

      return { contentId: input.contentId, revision, status: 'FAILED', error } as const;
    };

    const failed = steps.find(step => step.status === 'FAILED');
    if (failed) return fail(failed.failureMessage);

    const next = steps.find(step => step.status !== 'READY');

    if (!next) {
      if (!video || !PublicationPolicy.isApprovedVideo(status, revision, video.reviewStatus, video.revision)) {
        return fail('Use um vídeo aprovado da revisão atual do conteúdo.');
      }

      await this.contentPreparationRepository.complete(input, revision);
      
      return { contentId: input.contentId, revision, status: 'READY', videoId: video.id } as const;
    }

    if (next.status === 'NOT_STARTED') {
      try {
        if ((await next.request()).status === 'FAILED') return fail(next.failureMessage);
      } catch (error) {
        const message = error instanceof AppError ? error.message : next.failureMessage;
        this.logger.warn(`Conteúdo ${input.contentId}, revisão ${revision}: ${message}`);
        return fail(message);
      }
    }
    
    return { contentId: input.contentId, revision, status: 'PENDING' } as const;
  }
}
