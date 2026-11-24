import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { ContentStatus } from '@/modules/content/domain/entities/content-status';
import { RequestContext } from '@/shared/core/request-context/request-context';
import { requireRecord } from '@/shared/core/errors/app.error';
import type { CreatePublicationScheduleInput } from '../../domain/repositories/content-schedule.repository';
import { ContentScheduled } from '../../domain/entities/content-scheduled.entity';
import { Publication, PublicationWork } from '../../domain/entities/publication.entity';
import { CLAIM_LEASE_MS, PUBLICATION_CRON_BATCH_SIZE, PUBLICATION_GRACE_MS } from '../../domain/entities/publication-timing';
import { PreparedPublicationContent, PublicationRepository } from '../../domain/repositories/publication.repository';

import { preparationFailed, preparationReady } from '@/modules/content/infra/prisma/content-preparation.filters';
import { pendingSchedule } from './prisma-content-schedule-repository';

const include = { schedule: true } satisfies Prisma.PublicationInclude;
type Row = Prisma.PublicationGetPayload<{ include: typeof include }>;
const activeStatuses = ['SCHEDULED', 'PUBLISHING'] as const;
const statuses = { in: [...activeStatuses] };

@Injectable()
export class PrismaPublicationRepository implements PublicationRepository {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly requestContext: RequestContext,
  ) {}

  async createScheduled (input: CreatePublicationScheduleInput, client: Prisma.TransactionClient = this.prismaService) {
    const { publication } = await client.contentScheduled.create({
      data: {
        ...input,
        publication: { create: { socialAccountId: input.socialAccountId, caption: input.caption } },
      },
      select: { publication: { include } },
    });
    return this.toDomain(requireRecord(publication, 'Publicação'));
  }

  async createFromPreparedContent ({ companyId, contentId, revision, videoId }: PreparedPublicationContent) {
    await this.prismaService.serializable(async tx => {
      const video = await tx.videoAsset.findFirst({
        where: {
          companyId, contentId, id: videoId, revision, reviewStatus: 'APPROVED',
          content: { revision, ...preparationReady, status: { in: ['READY', 'APPROVED'] } },
        },
        select: { id: true },
      });
      if (!video) return;

      const schedules = await tx.contentScheduled.findMany({
        where: { ...pendingSchedule, companyId, contentId, date: { gt: new Date(Date.now() - PUBLICATION_GRACE_MS) } },
        select: { id: true, videoId: true, socialAccountId: true, caption: true },
      });
      for (const schedule of schedules) {
        if (!schedule.socialAccountId) continue;
        const where = { companyId_id: { companyId, id: schedule.id } };
        if (schedule.videoId && schedule.videoId !== video.id) {
          const error = 'Use um vídeo aprovado da revisão atual do conteúdo.';
          await tx.publication.updateMany({
            where: { companyId, scheduleId: schedule.id, status: 'SCHEDULED' },
            data: { status: 'FAILED', error },
          });
          await tx.contentScheduled.update({ where, data: { status: 'ERROR', preparationError: error } });
          continue;
        }
        await tx.contentScheduled.update({
          where,
          data: {
            status: 'READY', videoId: video.id,
            publication: {
              upsert: { create: { socialAccountId: schedule.socialAccountId, caption: schedule.caption }, update: {} },
            },
          },
        });
      }
    });
  }

  async findById (id: string) {
    const row = await this.prismaService.publication.findFirst({ where: { companyId: this.requestContext.companyId, id }, include });
    return row && this.toDomain(row);
  }

  findEligibleIds () {
    const now = new Date();
    return this.prismaService.publication.findMany({
      where: this.eligible(now),
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }], take: PUBLICATION_CRON_BATCH_SIZE, select: { id: true },
    });
  }

  async reserveForProcessing (id: string): Promise<PublicationWork | null> {
    const now = new Date();

    const leaseUntil = new Date(now.getTime() + CLAIM_LEASE_MS);

    return this.prismaService.$transaction(async tx => {
      const claimed = await tx.publication.updateMany({
        where: { id, ...this.eligible(now) },
        data: { status: 'PUBLISHING', leaseUntil },
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

  private eligible (now: Date): Prisma.PublicationWhereInput {
    return {
      status: statuses,
      OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }],
      schedule: {
        NOT: pendingSchedule,
        date: { lte: now },
        OR: [
          { content: preparationReady },
          { content: preparationFailed },
          { date: { lte: new Date(now.getTime() - PUBLICATION_GRACE_MS) } },
        ],
      },
    };
  }

  private toContentScheduled ({ id, companyId, contentId, videoId, date, status, createdAt, updatedAt }: Row['schedule']) {
    return new ContentScheduled(id, companyId, contentId, videoId, date, ContentStatus[status], createdAt, updatedAt);
  }

  private owned (job: PublicationWork) {
    return { id: job.id, companyId: job.companyId, leaseUntil: job.leaseUntil };
  }

  private toDomain (row: Row): Publication {
    const { id, companyId, status, socialAccountId, caption, containerId, externalId, error, schedule } = row;
    return {
      id, companyId, status, socialAccountId, caption, containerId, externalId, error,
      schedule: this.toContentScheduled(schedule),
    };
  }
}
