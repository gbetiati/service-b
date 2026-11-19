import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { OrchestratePublicationUseCase } from '../../application/use-cases/orchestrate-publication.usecase';
import { PUBLICATION_SCHEDULE } from './publication-schedule.queue';

@Processor(PUBLICATION_SCHEDULE, { concurrency: 4 })
export class PublicationScheduleProcessor extends WorkerHost {
  constructor(
    private readonly orchestratePublicationUseCase: OrchestratePublicationUseCase,
  ) {
    super();
  }

  async process(job: Job<{ id: string }>)
  {
    if (job.name === 'publish') await this.orchestratePublicationUseCase.execute(job.data.id);
  }
}
