import { Injectable } from '@nestjs/common';
import { ContentStatus } from '@/modules/content/domain/entities/content-status';
import { PrismaService } from '@/prisma/prisma.service';
import { PublicationSchedulingSession, PublicationSchedulingTransaction } from '../../application/ports/publication-scheduling-transaction';
import { PrismaPublicationRepository } from './publication.prisma-repository';

@Injectable()
export class PrismaPublicationSchedulingTransaction implements PublicationSchedulingTransaction {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly prismaPublicationRepository: PrismaPublicationRepository,
  ) {}

  run<T> (companyId: string, work: (session: PublicationSchedulingSession) => Promise<T>) {
    return this.prismaService.serializable(tx => work({
      findContent: async id => {
        const content = await tx.content.findUnique({
          where: { companyId_id: { companyId, id } },
          select: { status: true, revision: true, editorial: true },
        });
        return content && {
          status: ContentStatus[content.status], revision: content.revision, editorial: content.editorial as { caption?: string },
        };
      },

      findVideo: async (contentId, id) => {
        const video = await tx.videoAsset.findUnique({
          where: { companyId_contentId_id: { companyId, contentId, id } },
          select: { reviewStatus: true, revision: true },
        });
        return video && { reviewStatus: ContentStatus[video.reviewStatus], revision: video.revision };
      },

      findSocialAccount: async id => {
        const account = await tx.socialAccount.findUnique({
          where: { companyId_id: { companyId, id } },
          select: {
            status: true,
            credentials: { where: { kind: 'access_token' }, select: { expiresAt: true } },
          },
        });
        return account && { active: account.status === 'ACTIVE', credentials: account.credentials };
      },

      publicationRepository: {
        save: input => this.prismaPublicationRepository.save(input, tx),
      },
    }));
  }
}
