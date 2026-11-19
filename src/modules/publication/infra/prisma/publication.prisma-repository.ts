import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { ContentStatus } from '@/modules/content/domain/entities/content-status';
import { RequestContext } from '@/shared/core/request-context/request-context';
import { ContentScheduled } from '../../domain/entities/content-scheduled.entity';
import { Publication, PublicationWork } from '../../domain/entities/publication.entity';
import { CLAIM_LEASE_MS, DEFAULT_DEFER_MS, PUBLICATION_CRON_BATCH_SIZE, PUBLICATION_PREPARATION_MS } from '../../domain/entities/publication-timing';
import { PublicationRepository, SavePublicationInput } from '../../domain/repositories/publication.repository';

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
    const { companyId, contentId, videoId, socialAccountId, date, caption, nextAttemptAt } = input;
    return client.contentScheduled.create({
      data: { companyId, contentId, videoId, date, publication: { create: { socialAccountId, caption, nextAttemptAt } } },
      include: { publication: true },
    }).then(({ publication, ...schedule }) => this.toDomain({ ...publication!, schedule }));
  }

  async findById (id: string) {
    const row = await this.prismaService.publication.findFirst({ where: { companyId: this.requestContext.companyId, id }, include });
    return row && this.toDomain(row);
  }

  duePublicationIds () {
    const now = new Date();
    return this.prismaService.publication.findMany({
      where: { status: statuses, nextAttemptAt: { lte: now }, ...this.available(now) },
      orderBy: [{ nextAttemptAt: 'asc' }, { id: 'asc' }], take: PUBLICATION_CRON_BATCH_SIZE, select: { id: true },
    });
  }

  async claim (id: string): Promise<PublicationWork | null> {
    const now = new Date();

    const leaseUntil = new Date(now.getTime() + CLAIM_LEASE_MS);

    return this.prismaService.$transaction(async tx => {
      const claimed = await tx.publication.updateMany({
        where: { id, status: statuses, nextAttemptAt: { lte: now }, ...this.available(now) }, data: { status: 'PUBLISHING', leaseUntil },
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
        ...this.toDomain(row), leaseUntil, nextAttemptAt: row.nextAttemptAt,
        accountExternalId: row.socialAccount.externalId, accountActive: row.socialAccount.status === 'ACTIVE',
        credential: row.socialAccount.credentials[0] ?? null,
      };
    });
  }

  async waitForVideo (job: PublicationWork, nextAttemptAt: Date) {
    const changed = await this.prismaService.publication.updateMany({
      where: { ...this.owned(job), nextAttemptAt: job.nextAttemptAt },
      data: { leaseUntil: null, nextAttemptAt },
    });

    if (!changed.count) {
      // A callback changed the attempt time while this worker held the lease.
      await this.prismaService.publication.updateMany({ where: this.owned(job), data: { leaseUntil: null } });
    }
  }

  async resumeForContent (companyId: string, contentId: string, revision: number) {
    const now = new Date();
    const preparationLimit = new Date(now.getTime() + PUBLICATION_PREPARATION_MS);
    // Change the timestamp even when a callback and the current attempt share the same millisecond.
    await this.prismaService.$executeRaw`
      WITH timing AS (
        SELECT ${now}::timestamptz AT TIME ZONE 'UTC' AS now_utc,
               ${preparationLimit}::timestamptz AT TIME ZONE 'UTC' AS preparation_limit
      )
      UPDATE publications AS p
      SET "nextAttemptAt" = CASE WHEN p."nextAttemptAt" = timing.now_utc
                               THEN timing.now_utc - INTERVAL '1 millisecond' ELSE timing.now_utc END,
          "updatedAt" = timing.now_utc
      FROM content_scheduled AS s
      JOIN contents AS c ON c."companyId" = s."companyId" AND c.id = s."contentId"
      CROSS JOIN timing
      WHERE p."companyId" = ${companyId} AND s."companyId" = p."companyId" AND s.id = p."scheduleId"
        AND s."contentId" = ${contentId} AND c.revision = ${revision}
        AND s."videoId" IS NULL AND s.date <= timing.preparation_limit
        AND p.status IN (${Prisma.join(activeStatuses.map(status => Prisma.sql`${status}::"PublicationStatus"`))})
        AND (p."nextAttemptAt" > timing.now_utc OR p."leaseUntil" > timing.now_utc)
    `;
  }

  async markReady (job: PublicationWork, videoId: string) {
    await this.prismaService.contentScheduled.updateMany({
      where: { id: job.schedule.id, companyId: job.companyId, publication: this.owned(job) },
      data: { videoId, status: 'READY' },
    });
  }

  async defer (job: PublicationWork, containerId?: string, nextAttemptAt = new Date(Date.now() + DEFAULT_DEFER_MS)) {
    await this.prismaService.publication.updateMany({
      where: this.owned(job), data: { leaseUntil: null, containerId, nextAttemptAt },
    });
  }

  succeed (job: PublicationWork, externalId?: string) {
    return this.finish(job, { status: 'PUBLISHED', externalId }, 'APPROVED');
  }

  fail (job: PublicationWork, error: string) {
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

  private available (now: Date) {
    return { OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }] };
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
