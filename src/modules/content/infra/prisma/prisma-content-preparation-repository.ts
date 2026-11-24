import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AppError } from '@/shared/core/errors/app.error';
import { ContentStatus } from '../../domain/entities/content-status';
import { ContentPreparationInput, ContentPreparationRepository } from '../../domain/repositories/content-preparation.repository';
import { preparationFailed, preparationReady, runnablePreparation } from './content-preparation.filters';

const videoFields = { id: true, storageKey: true, captionedStorageKey: true, revision: true, reviewStatus: true } as const;
const preparationFields = {
  revision: true, status: true, scriptStatus: true, videoStatus: true, transcriptionStatus: true, subtitleStatus: true, subtitleLeaseUntil: true,
} as const;

@Injectable()
export class PrismaContentPreparationRepository implements ContentPreparationRepository {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async request ({ companyId, contentId }: ContentPreparationInput) {
    const result = await this.prisma.content.updateMany({ where: { companyId, id: contentId }, data: { publicationPreparationRequested: true } });

    if (!result.count) throw new AppError('missing', 'Conteúdo não encontrado.');
  }

  async findEligibleContents (limit: number) {
    const rows = await this.prisma.content.findMany({
      where: { publicationPreparationRequested: true, OR: [runnablePreparation(new Date()), preparationReady, preparationFailed] },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: limit,
      select: { id: true, companyId: true, updatedAt: true },
    });
    return rows.map(({ id, companyId, updatedAt }) => ({ contentId: id, companyId, updatedAt }));
  }

  read ({ companyId, contentId }: ContentPreparationInput, videoId?: string | null) {
    return this.prisma.$transaction(async tx => {
      const content = await tx.content.findUnique({ where: { companyId_id: { companyId, id: contentId } }, select: preparationFields });

      if (!content) throw new AppError('missing', 'Conteúdo não encontrado.');

      const generation = videoId ? null : await tx.videoGeneration.findUnique({
        where: { companyId_contentId_revision: { companyId, contentId, revision: content.revision } },
        select: { video: { select: videoFields } },
      });
      const video = videoId
        ? await tx.videoAsset.findUnique({ where: { companyId_contentId_id: { companyId, contentId, id: videoId } }, select: videoFields })
        : generation?.video ?? null;
      // Uma legenda com lease vencido volta a ser elegível para execução.
      const subtitleLeaseExpired = content.subtitleStatus === 'PENDING' && !!content.subtitleLeaseUntil && content.subtitleLeaseUntil.getTime() <= Date.now();

      return {
        status: ContentStatus[content.status],
        scriptStatus: content.scriptStatus,
        videoStatus: content.videoStatus,
        transcriptionStatus: content.transcriptionStatus,
        subtitleStatus: subtitleLeaseExpired ? 'NOT_STARTED' as const : content.subtitleStatus,
        revision: content.revision,
        video: video && {
          id: video.id, revision: video.revision,
          reviewStatus: ContentStatus[video.reviewStatus], storageKey: video.captionedStorageKey ?? video.storageKey,
        },
      };
    }, { isolationLevel: 'RepeatableRead' });
  }

  async complete ({ companyId, contentId }: ContentPreparationInput, revision: number) {
    await this.prisma.content.updateMany({
      where: { id: contentId, companyId, revision, publicationPreparationRequested: true },
      data: { publicationPreparationRequested: false },
    });
  }
}
