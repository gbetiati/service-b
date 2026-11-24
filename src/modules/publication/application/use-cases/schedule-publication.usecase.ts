import { Injectable } from '@nestjs/common';
import { RequestContext } from '@/shared/core/request-context/request-context';
import { PublicationSchedulingTransaction } from '../ports/publication-scheduling-transaction';
import { SchedulePublicationDto } from '../dto/schedule-publication.dto';
import { validatePublicationSchedule } from '../services/validate-publication-schedule';

@Injectable()
export class SchedulePublicationUseCase {
  constructor(
    private readonly publicationSchedulingTransaction: PublicationSchedulingTransaction,
    private readonly requestContext: RequestContext,
  ) {}

  execute (dto: SchedulePublicationDto) {
    const companyId = this.requestContext.companyId;
    return this.publicationSchedulingTransaction.run(companyId, async session => {
      const input = await validatePublicationSchedule(companyId, dto, session);
      return session.contentScheduleRepository.save(input);
    });
  }
}
