import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ContentPreparationRepository } from '@/modules/content/domain/repositories/content-preparation.repository';
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
  ) {}

  @Cron('*/5 * * * * *', { waitForCompletion: true })
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

    await Promise.all(contents.map(async ({ companyId, contentId }) => {
      const input = { companyId, contentId };
      try {
        const result = await this.publicationOrchestrator.execute(input);
        if (!scheduledIds.has(input.contentId)) return;

        if (result.status === 'READY') {
          await this.publicationRepository.createFromPreparedContent({ ...input, revision: result.revision, videoId: result.videoId });
        } else if (result.status === 'FAILED') {
          await this.contentScheduleRepository.failPreparation(input, result.revision, result.error);
        }
      } catch (error) {
        this.logger.error(`Falha ao processar o conteúdo ${input.contentId}.`, error instanceof Error ? error.stack : undefined);
      }
    }));
  }

  @Cron('*/5 * * * * *', { waitForCompletion: true })
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
