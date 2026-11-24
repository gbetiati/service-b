import { ContentStatus } from '@/modules/content/domain/entities/content-status';
import { PublicationPolicy } from './publication.policy';
import type { PublicationStatus } from './publication.entity';
import { AppError } from '@/shared/core/errors/app.error';

export type PublicationSchedule = ContentScheduled & {
  socialAccountId: string | null;
  caption: string | null;
  preparationError: string | null;
  publication: { id: string; status: PublicationStatus } | null;
};

export class ContentScheduled {
  constructor(
    readonly id: string,
    readonly companyId: string,
    readonly contentId: string | null,
    readonly videoId: string | null,
    readonly date: Date,
    readonly status: ContentStatus,
    readonly createdAt: Date,
    readonly updatedAt: Date,
  ) {}

  static validateDate (date: Date) {
    if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) throw new AppError('invalid', 'Escolha uma data futura.');
  }

  static validateVideo (status: ContentStatus, revision: number, videoStatus: ContentStatus, videoRevision: number) {
    if (!PublicationPolicy.isApprovedVideo(status, revision, videoStatus, videoRevision)) {
      throw new AppError('conflict', 'Use um vídeo aprovado da revisão atual do conteúdo.');
    }
  }
}
