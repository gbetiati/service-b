import { AppError, requireRecord } from '@/shared/core/errors/app.error';
import { ContentScheduled } from '../../domain/entities/content-scheduled.entity';
import { PublicationPolicy } from '../../domain/entities/publication.policy';
import type { SaveContentScheduleInput } from '../../domain/repositories/content-schedule.repository';
import type { SchedulePublicationDto } from '../dto/schedule-publication.dto';
import type { PublicationSchedulingSession } from '../ports/publication-scheduling-transaction';

export async function validatePublicationSchedule (
  companyId: string,
  dto: SchedulePublicationDto,
  { findContent, findVideo, findSocialAccount }: PublicationSchedulingSession,
): Promise<SaveContentScheduleInput> {
  const { contentId, videoId, socialAccountId } = dto;
  const date = new Date(dto.date);
  ContentScheduled.validateDate(date);
  const content = requireRecord(await findContent(contentId), 'Conteúdo');

  if (videoId) {
    const video = requireRecord(await findVideo(contentId, videoId), 'Vídeo');
    ContentScheduled.validateVideo(content.status, content.revision, video.reviewStatus, video.revision);
  }

  await validatePublicationAccount(socialAccountId, date, findSocialAccount);

  return { companyId, contentId, videoId, socialAccountId, date, caption: dto.caption ?? content.editorial.caption };
}

export async function validatePublicationAccount (
  socialAccountId: string,
  date: Date,
  findSocialAccount: PublicationSchedulingSession['findSocialAccount'],
) {
  const account = requireRecord(await findSocialAccount(socialAccountId), 'Conta social');
  const now = Date.now();
  if (!account.credentials.some(credential => PublicationPolicy.canPublishWithCredential(account.active, credential, date, now))) {
    throw new AppError('conflict', 'Conecte uma conta com credencial válida na data programada.');
  }
}
