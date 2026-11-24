import { Injectable } from '@nestjs/common';
import { CreateContentUseCase } from '@/modules/content/application/use-cases/create-content.usecase';
import { AppError } from '@/shared/core/errors/app.error';
import { RequestContext } from '@/shared/core/request-context/request-context';
import { ContentScheduled } from '../../domain/entities/content-scheduled.entity';
import { CreateScheduledPublicationDto } from '../dto/create-scheduled-publication.dto';
import { PublicationSchedulingTransaction } from '../ports/publication-scheduling-transaction';
import { validatePublicationAccount, validatePublicationSchedule } from '../services/validate-publication-schedule';

@Injectable()
export class CreateScheduledPublicationUseCase {
  constructor(
    private readonly publicationSchedulingTransaction: PublicationSchedulingTransaction,
    private readonly requestContext: RequestContext,
    private readonly createContent: CreateContentUseCase,
  ) {}

  execute (dto: CreateScheduledPublicationDto) {
    const { contentId, contentDraft, socialAccountId, caption } = dto;
    if (Boolean(contentId) === Boolean(contentDraft)) {
      throw new AppError('invalid', 'Escolha um conteúdo existente ou informe campanha, regras e produto.');
    }

    const companyId = this.requestContext.companyId;
    return this.publicationSchedulingTransaction.run(companyId, async session => {
      if (contentId) {
        const input = await validatePublicationSchedule(companyId, { ...dto, contentId }, session);
        return session.publicationRepository.createScheduled(input);
      }

      if (!contentDraft || dto.videoId) {
        throw new AppError('invalid', 'Um vídeo existente só pode ser associado a um conteúdo existente.');
      }

      const date = new Date(dto.date);
      ContentScheduled.validateDate(date);
      await validatePublicationAccount(socialAccountId, date, session.findSocialAccount);
      await this.createContent.validateReferences(contentDraft);
      return session.publicationRepository.createScheduled({ companyId, contentDraft, socialAccountId, date, caption });
    });
  }
}
