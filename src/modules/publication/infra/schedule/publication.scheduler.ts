import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ContentPreparationInput, ContentPreparationRepository } from '@/modules/content/domain/repositories/content-preparation.repository';
import { ProcessScheduledContentUseCase } from '../../application/use-cases/process-scheduled-content.usecase';
import { PublicationOrchestrator } from '../../application/use-cases/publication.orchestrator';
import { PublishScheduledContentUseCase } from '../../application/use-cases/publish-scheduled-content.usecase';
import { PUBLICATION_CRON_BATCH_SIZE } from '../../domain/entities/publication-timing';
import { ContentScheduleRepository } from '../../domain/repositories/content-schedule.repository';
import { PublicationRepository } from '../../domain/repositories/publication.repository';

@Injectable()
export class PublicationScheduler {
  private readonly logger = new Logger(PublicationScheduler.name);

  constructor(
    private readonly publicationRepository: PublicationRepository,
    private readonly publicationOrchestrator: PublicationOrchestrator,
    private readonly contentPreparationRepository: ContentPreparationRepository,
    private readonly contentScheduleRepository: ContentScheduleRepository,
    private readonly publishScheduledContentUseCase: PublishScheduledContentUseCase,
    private readonly processScheduledContentUseCase: ProcessScheduledContentUseCase,
  ) {}

  @Cron('*/5 * * * * *', { waitForCompletion: true })
  // Prepara conteúdos solicitados manualmente e os que têm agendamento dentro da janela de preparação.
  async prepare () {
    await this.contentScheduleRepository.expireSchedules();

    const [requested, scheduled] = await Promise.all([
      this.contentPreparationRepository.findEligibleContents(PUBLICATION_CRON_BATCH_SIZE),
      this.contentScheduleRepository.findEligibleContents(),
    ]);

    const scheduledIds = new Set(scheduled.map(({ contentId }) => contentId));
    const contents = [...scheduled, ...requested.filter(({ contentId }) => !scheduledIds.has(contentId))]
      .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime() || a.contentId.localeCompare(b.contentId))
      .slice(0, PUBLICATION_CRON_BATCH_SIZE);

    await Promise.all(contents.map(({ companyId, contentId }) =>
      this.prepareContent({ companyId, contentId }, scheduledIds.has(contentId)),
    ));
  }

  @Cron('*/10 * * * * *', { name: 'Content-process', waitForCompletion: true })
  // Cria o conteúdo dos agendamentos feitos por rascunho quando entram na janela de preparação.
  async processContent () {
    const drafts = await this.contentScheduleRepository.findEligibleDrafts();
    await Promise.all(drafts.map(async ({ id }) => {
      try {
        const input = await this.processScheduledContentUseCase.execute(id);
        if (input) await this.prepareContent(input, true);
      } catch (error) {
        this.logger.error(`Falha ao processar o agendamento ${id}.`, error instanceof Error ? error.stack : undefined);
      }
    }));
  }

  private async prepareContent (input: ContentPreparationInput, scheduled: boolean) {
    try {
      const result = await this.publicationOrchestrator.execute(input);

      if (!scheduled) return;

      // TESTE (mock): criação da publicação comentada; o fluxo para no upload do vídeo para o S3.
      // if (result.status === 'READY') {
      //   await this.publicationRepository.createFromPreparedContent({ ...input, revision: result.revision, videoId: result.videoId });
      // } else if (result.status === 'FAILED') {
      if (result.status === 'FAILED') {
        await this.contentScheduleRepository.failPreparation(input, result.revision, result.error);
      }
    } catch (error) {
      this.logger.error(`Falha ao processar o conteúdo ${input.contentId}.`, error instanceof Error ? error.stack : undefined);
    }
  }

  // TESTE (mock): cron de publicação desligado; reative o decorator abaixo.
  // @Cron('*/5 * * * * *', { waitForCompletion: true })
  async publishReady () {
    const publications = await this.publicationRepository.findEligibleIds();

    await Promise.all(publications.map(async ({ id }) => {
      try {
        await this.publishScheduledContentUseCase.processScheduled(id);
      } catch (error) {
        this.logger.error(`Falha ao processar a publicação ${id}.`, error instanceof Error ? error.stack : undefined);
      }
    }));
  }
}
