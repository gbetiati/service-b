import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { PublicationExecutionReader } from '../../application/ports/publication-execution-reader';
import type { PublicationWork } from '../../domain/entities/publication.entity';
import { PublicationPolicy } from '../../domain/entities/publication.policy';

const videoFields = { id: true, storageKey: true, revision: true, reviewStatus: true } as const;

@Injectable()
export class PrismaPublicationExecutionReader implements PublicationExecutionReader {
  constructor(
    private readonly prismaService: PrismaService,
  ) {}

  readVideo (job: PublicationWork) {
    const { companyId, schedule: { contentId, videoId } } = job;
    return this.prismaService.$transaction(async tx => {
      const content = await tx.content.findUniqueOrThrow({
        where: { companyId_id: { companyId, id: contentId } },
        select: { revision: true, status: true },
      });
      const generation = videoId ? null : await tx.videoGeneration.findUnique({
        where: { companyId_contentId_revision: { companyId, contentId, revision: content.revision } },
        select: { status: true, video: { select: videoFields } },
      });
      const video = videoId ? await tx.videoAsset.findUnique({
        where: { companyId_contentId_id: { companyId, contentId, id: videoId } },
        select: videoFields,
      }) : generation?.video ?? null;

      return {
        generationStatus: generation?.status ?? null,
        approved: !!video && PublicationPolicy.isApprovedVideo(content.status, content.revision, video.reviewStatus, video.revision),
        video: video && { id: video.id, storageKey: video.storageKey },
      };
    }, { isolationLevel: 'RepeatableRead' });
  }
}
