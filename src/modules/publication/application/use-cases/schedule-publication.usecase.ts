import { Injectable } from '@nestjs/common';
import { AppError, requireRecord } from '@/shared/core/errors/app.error';
import { RequestContext } from '@/shared/core/request-context/request-context';
import { ContentScheduled } from '../../domain/entities/content-scheduled.entity';
import { PublicationPolicy } from '../../domain/entities/publication.policy';
import { PublicationSchedulingTransaction } from '../ports/publication-scheduling-transaction';
import { SchedulePublicationDto } from '../dto/schedule-publication.dto';

@Injectable()
export class SchedulePublicationUseCase {
  constructor(
    private readonly publicationSchedulingTransaction: PublicationSchedulingTransaction,
    private readonly requestContext: RequestContext,
  ) {}

  execute (dto: SchedulePublicationDto) {
    const companyId = this.requestContext.companyId;
    const { contentId, videoId, socialAccountId } = dto;
    const date = new Date(dto.date);

    return this.publicationSchedulingTransaction.run(companyId, async ({
      findContent, findVideo, findSocialAccount, publicationRepository,
    }) => {
      ContentScheduled.validateDate(date);
      const content = requireRecord(await findContent(contentId), 'Conteúdo');

      if (videoId) {
        const video = requireRecord(await findVideo(contentId, videoId), 'Vídeo');
        ContentScheduled.validateVideo(content.status, content.revision, video.reviewStatus, video.revision);
      }

      const account = requireRecord(await findSocialAccount(socialAccountId), 'Conta social');
      const now = Date.now();

      if (!account.credentials.some(credential => PublicationPolicy.canPublishWithCredential(account.active, credential, date, now))) {
        throw new AppError('conflict', 'Conecte uma conta com credencial válida na data programada.');
      }

      return publicationRepository.save({
        companyId, contentId, videoId, socialAccountId, date,
        caption: dto.caption ?? content.editorial.caption,
      });
    });
  }
}
