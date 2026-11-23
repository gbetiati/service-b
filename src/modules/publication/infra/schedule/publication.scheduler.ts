import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PublicationOrchestrator } from '../../application/use-cases/publication.orchestrator';
import { PublicationPhase, PublicationRepository } from '../../domain/repositories/publication.repository';

@Injectable()
export class PublicationScheduler {
  private readonly logger = new Logger(PublicationScheduler.name);

  constructor(
    private readonly publicationRepository: PublicationRepository,
    private readonly publicationOrchestrator: PublicationOrchestrator,
  ) {}

  @Cron('*/5 * * * * *', { waitForCompletion: true })
  prepare () {
    return this.dispatch('preparation');
  }

  @Cron('*/5 * * * * *', { waitForCompletion: true })
  publishReady () {
    return this.dispatch('publication');
  }

  private async dispatch (phase: PublicationPhase) {
    const due = await this.publicationRepository.findEligibleIds(phase);
    const results = await Promise.allSettled(due.map(({ id }) => this.publicationOrchestrator.execute(id, phase)));
    if (due.length > 0) {
      console.log('DISPACHHH', due, results);
    }

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.log('res', result)
        const error = result.reason instanceof Error ? result.reason.stack : undefined;
        this.logger.error(`Falha ao processar a publicação ${due[index].id}.`, error);
      }
    });
  }
}
