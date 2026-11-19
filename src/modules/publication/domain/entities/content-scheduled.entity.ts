import { ContentStatus } from '@/modules/content/domain/entities/content-status';
import { AppError } from '@/shared/core/errors/app.error';

export class ContentScheduled {
  constructor(
    readonly id: string,
    readonly companyId: string,
    readonly contentId: string,
    readonly videoId: string | null,
    readonly date: Date,
    readonly status: ContentStatus,
    readonly createdAt: Date,
    readonly updatedAt: Date,
  ) {}

  static validateDate(date: Date)
  {
    if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) throw new AppError('invalid', 'Escolha uma data futura.');
  }

  static validateVideo(status: ContentStatus, revision: number, videoStatus: ContentStatus, videoRevision: number)
  {
    if ((status !== ContentStatus.APPROVED && status !== ContentStatus.READY) || videoStatus !== ContentStatus.APPROVED || revision !== videoRevision) {
      throw new AppError('conflict', 'Use um vídeo aprovado da revisão atual do conteúdo.');
    }
  }
}
