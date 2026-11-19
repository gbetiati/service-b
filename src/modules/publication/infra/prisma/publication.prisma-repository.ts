import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { ContentStatus } from '@/modules/content/domain/entities/content-status';
import { RequestContext } from '@/shared/core/request-context/request-context';
import { ContentScheduled } from '../../domain/entities/content-scheduled.entity';
import { Publication, PublicationWork } from '../../domain/entities/publication.entity';
import { CLAIM_LEASE_MS, PUBLICATION_CRON_BATCH_SIZE, PUBLICATION_GRACE_MS, PUBLICATION_PREPARATION_MS } from '../../domain/entities/publication-timing';
import { PublicationPhase, PublicationRepository, SavePublicationInput } from '../../domain/repositories/publication.repository';

const include = { schedule: true } satisfies Prisma.PublicationInclude;
type Row = Prisma.PublicationGetPayload<{ include: typeof include }>;
const activeStatuses = ['SCHEDULED', 'PUBLISHING'] as const;
const statuses = { in: [...activeStatuses] };

@Injectable()
export class PrismaPublicationRepository implements PublicationRepository {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly requestContext: RequestContext,
  ) { }

  save (input: SavePublicationInput, client: Prisma.TransactionClient = this.prismaService) {
    const { companyId, contentId, videoId, socialAccountId, date, caption } = input;
    return client.contentScheduled.create({
      data: { companyId, contentId, videoId, date, publication: { create: { socialAccountId, caption } } },
      include: { publication: true },
    }).then(({ publication, ...schedule }) => this.toDomain({ ...publication!, schedule }));
  }

  async findById (id: string) {
    const row = await this.prismaService.publication.findFirst({ where: { companyId: this.requestContext.companyId, id }, include });
    return row && this.toDomain(row);
  }

  findEligibleIds (phase: PublicationPhase) {
    const now = new Date();
    return this.prismaService.publication.findMany({
      where: this.eligible(phase, now),
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }], take: PUBLICATION_CRON_BATCH_SIZE, select: { id: true },
    });
  }

  async reserveForProcessing (id: string, phase: PublicationPhase): Promise<PublicationWork | null> {
    const now = new Date();

    const leaseUntil = new Date(now.getTime() + CLAIM_LEASE_MS);

    return this.prismaService.$transaction(async tx => {
      const claimed = await tx.publication.updateMany({
        where: { id, ...this.eligible(phase, now) },
        data: { status: phase === 'publication' ? 'PUBLISHING' : undefined, leaseUntil },
      });

      if (!claimed.count) return null;

      const row = await tx.publication.findUniqueOrThrow({
        where: { id },
        include: {
          schedule: true,
          socialAccount: {
            select: {
              externalId: true, status: true,
              credentials: {
                where: { kind: 'access_token' },
                orderBy: [{ expiresAt: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }],
                take: 1,
              },
            },
          },
        },
      });

      return {
        ...this.toDomain(row), leaseUntil,
        accountExternalId: row.socialAccount.externalId, accountActive: row.socialAccount.status === 'ACTIVE',
        credential: row.socialAccount.credentials[0] ?? null,
      };
    });
  }

  async attachApprovedVideo (job: PublicationWork, videoId: string) {
    await this.prismaService.contentScheduled.updateMany({
      where: { id: job.schedule.id, companyId: job.companyId, publication: this.owned(job) },
      data: { videoId, status: 'READY' },
    });
  }

  async releaseProcessing (job: PublicationWork, containerId?: string) {
    await this.prismaService.publication.updateMany({
      where: this.owned(job), data: { leaseUntil: null, containerId },
    });
  }

  markPublished (job: PublicationWork, externalId?: string) {
    return this.finish(job, { status: 'PUBLISHED', externalId }, 'APPROVED');
  }

  markFailed (job: PublicationWork, error: string) {
    return this.finish(job, { status: 'FAILED', error }, 'ERROR');
  }

  private async finish (job: PublicationWork, data: Prisma.PublicationUpdateManyMutationInput, status: 'APPROVED' | 'ERROR') {
    await this.prismaService.$transaction(async tx => {
      const changed = await tx.publication.updateMany({ where: this.owned(job), data: { ...data, leaseUntil: null } });

      if (changed.count) await tx.contentScheduled.update({
        where: { companyId_id: { companyId: job.companyId, id: job.schedule.id } }, data: { status },
      });
    });
  }

  private eligible (phase: PublicationPhase, now: Date): Prisma.PublicationWhereInput {
    const available = { OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }] };
    const ready = { scriptStatus: 'READY', videoStatus: 'READY' } as const;

    if (phase === 'publication') {
      return { status: statuses, ...available, schedule: { date: { lte: now }, content: ready } };
    }

    return {
      status: statuses, ...available,
      schedule: {
        date: { lte: new Date(now.getTime() + PUBLICATION_PREPARATION_MS) },
        content: { NOT: ready },
        OR: [
          { date: { lte: new Date(now.getTime() - PUBLICATION_GRACE_MS) } },
          { content: { scriptStatus: { in: ['NOT_STARTED', 'FAILED'] } } },
          { content: { videoStatus: 'FAILED' } },
          { content: { scriptStatus: 'READY', videoStatus: 'NOT_STARTED' } },
        ],
      },
    };
  }

  private owned (job: PublicationWork) {
    return { id: job.id, companyId: job.companyId, leaseUntil: job.leaseUntil };
  }

  private toDomain (row: Row): Publication {
    const { id, companyId, status, socialAccountId, caption, containerId, externalId, error, schedule } = row;
    return {
      id, companyId, status, socialAccountId, caption, containerId, externalId, error,
      schedule: new ContentScheduled(
        schedule.id, companyId, schedule.contentId, schedule.videoId, schedule.date, ContentStatus[schedule.status], schedule.createdAt, schedule.updatedAt,
      ),
    };
  }
}
