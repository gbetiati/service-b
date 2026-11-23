import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AppError } from '@/shared/core/errors/app.error';
import { SubtitleJob, VideoSubtitlesRepository } from '../../domain/repositories/video-subtitles.repository';

@Injectable()
export class PrismaVideoSubtitlesRepository implements VideoSubtitlesRepository {
  constructor(private readonly prisma: PrismaService) {}

  claim ({ companyId, contentId, revision }: Parameters<VideoSubtitlesRepository['claim']>[0]) {
    const now = new Date();
    const leaseUntil = new Date(now.getTime() + 5 * 60_000);
    return this.prisma.$transaction(async tx => {
      const changed = await tx.content.updateMany({
        where: {
          id: contentId, companyId, revision, transcriptionStatus: 'READY',
          OR: [{ subtitleStatus: 'NOT_STARTED' }, { subtitleStatus: 'PENDING', subtitleLeaseUntil: { lte: now } }],
        },
        data: { subtitleStatus: 'PENDING', subtitleLeaseUntil: leaseUntil },
      });
      if (!changed.count) return null;

      const content = await tx.content.findUniqueOrThrow({
        where: { companyId_id: { companyId, id: contentId } }, select: { subtitleSrt: true },
      });
      const render = await tx.videoGeneration.findUnique({
        where: { companyId_contentId_revision: { companyId, contentId, revision } },
        select: { video: { select: { id: true, storageKey: true } } },
      });
      if (!render?.video || content.subtitleSrt === null) {
        throw new AppError('invalid', 'O vídeo ou as legendas da revisão atual não foram encontrados.');
      }
      return { companyId, contentId, revision, leaseUntil, videoId: render.video.id, storageKey: render.video.storageKey, srt: content.subtitleSrt };
    });
  }

  async finish ({ companyId, contentId, revision, videoId, leaseUntil }: SubtitleJob, outputKey: string | null) {
    await this.prisma.$transaction(async tx => {
      const changed = await tx.content.updateMany({
        where: { id: contentId, companyId, revision, subtitleLeaseUntil: leaseUntil, subtitleStatus: 'PENDING' },
        data: { subtitleStatus: outputKey === null ? 'FAILED' : 'READY', subtitleLeaseUntil: null },
      });
      if (!changed.count || outputKey === null) return;

      await tx.videoAsset.update({
        where: { companyId_contentId_id: { companyId, contentId, id: videoId } },
        data: { captionedStorageKey: outputKey },
      });
    });
  }
}
