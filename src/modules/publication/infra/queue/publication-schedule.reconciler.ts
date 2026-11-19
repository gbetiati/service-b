import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { Queue } from 'bullmq';
import { PublicationRepository } from '../../domain/repositories/publication.repository';
import { PUBLICATION_SCHEDULE } from './publication-schedule.queue';

@Injectable()
export class PublicationScheduleReconciler {
  private readonly logger = new Logger(PublicationScheduleReconciler.name);
  constructor(
    private readonly publicationRepository: PublicationRepository,
    @InjectQueue(PUBLICATION_SCHEDULE) private readonly queue: Queue,
  ) {}

  @Cron('*/5 * * * * *', { waitForCompletion: true })
  async dispatch()
  {
    try {
      const entries = await this.publicationRepository.pendingJobs();
      if (!entries.length) return;
      await this.queue.addBulk(entries.map(({ id, nextAttemptAt }) => ({
        name: 'publish', data: { id },
        opts: {
          jobId: id + '-' + nextAttemptAt.getTime(), delay: Math.max(0, nextAttemptAt.getTime() - Date.now()),
          removeOnComplete: true, removeOnFail: true, attempts: 3, backoff: { type: 'exponential', delay: 5000 },
        },
      })));
    } catch {
      this.logger.error('Falha ao sincronizar o agendamento com Redis.');
    }
  }
}
