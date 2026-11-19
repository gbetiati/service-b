import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PublicationOrchestrator } from '../../application/use-cases/publication.orchestrator';
import { PublicationRepository } from '../../domain/repositories/publication.repository';

@Injectable()
export class PublicationScheduler {
  private readonly logger = new Logger(PublicationScheduler.name);

  constructor(
    private readonly publicationRepository: PublicationRepository,
    private readonly publicationOrchestrator: PublicationOrchestrator,
  ) {}

  @Cron('*/5 * * * * *', { waitForCompletion: true })
  async dispatch () {
    const due = await this.publicationRepository.duePublicationIds();
    const results = await Promise.allSettled(due.map(({ id }) => this.publicationOrchestrator.execute(id)));

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const error = result.reason instanceof Error ? result.reason.stack : undefined;
        this.logger.error(`Falha ao processar a publicação ${due[index].id}.`, error);
      }
    });
  }
}
