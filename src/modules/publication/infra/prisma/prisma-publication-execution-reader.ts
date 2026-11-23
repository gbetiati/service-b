import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { PublicationExecutionReader } from '../../application/ports/publication-execution-reader';
import type { PublicationWork } from '../../domain/entities/publication.entity';
import { PublicationPolicy } from '../../domain/entities/publication.policy';

const videoFields = { id: true, storageKey: true, captionedStorageKey: true, revision: true, reviewStatus: true } as const;

@Injectable()
export class PrismaPublicationExecutionReader implements PublicationExecutionReader {
  constructor(
    private readonly prismaService: PrismaService,
  ) {}

  readPreparationState (job: PublicationWork) {
    const { companyId, schedule: { contentId, videoId } } = job;
    return this.prismaService.$transaction(async tx => {
      const content = await tx.content.findUniqueOrThrow({
        where: { companyId_id: { companyId, id: contentId } },
        select: { revision: true, status: true, scriptStatus: true, videoStatus: true, transcriptionStatus: true, subtitleStatus: true, subtitleLeaseUntil: true },
      });
      const generation = videoId ? null : await tx.videoGeneration.findUnique({
        where: { companyId_contentId_revision: { companyId, contentId, revision: content.revision } },
        select: { video: { select: videoFields } },
      });
      const video = videoId ? await tx.videoAsset.findUnique({
        where: { companyId_contentId_id: { companyId, contentId, id: videoId } },
        select: videoFields,
      }) : generation?.video ?? null;

      return {
        scriptStatus: content.scriptStatus,
        videoStatus: content.videoStatus,
        transcriptionStatus: content.transcriptionStatus,
        subtitleStatus: content.subtitleStatus === 'PENDING' && content.subtitleLeaseUntil && content.subtitleLeaseUntil.getTime() <= Date.now()
          ? 'NOT_STARTED' as const
          : content.subtitleStatus,
        revision: content.revision,
        approved: !!video && PublicationPolicy.isApprovedVideo(content.status, content.revision, video.reviewStatus, video.revision),
        video: video && { id: video.id, storageKey: video.captionedStorageKey ?? video.storageKey },
      };
    }, { isolationLevel: 'RepeatableRead' });
  }
}
