import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { PublishScheduledContentUseCase } from '../../application/use-cases/publish-scheduled-content.usecase';
import { PUBLICATION_SCHEDULE } from './publication-schedule.queue';

@Processor(PUBLICATION_SCHEDULE)
export class PublicationScheduleProcessor extends WorkerHost {
  constructor(
    private readonly publishScheduledContentUseCase: PublishScheduledContentUseCase,
  ) {
    super();
  }

  async process(job: Job<{ id: string }>)
  {
    await this.publishScheduledContentUseCase.execute(job.data.id);
  }
}
