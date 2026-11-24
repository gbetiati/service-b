import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Content } from '@/modules/content/domain/entities/content.entity';
import { PrismaContentRepository } from '@/modules/content/infra/prisma/content.prisma-repository';
import { PrismaService } from '@/prisma/prisma.service';
import { RequestContext } from '@/shared/core/request-context/request-context';
import type { ContentPreparationInput } from '@/modules/content/domain/repositories/content-preparation.repository';
import { ContentStatus } from '@/modules/content/domain/entities/content-status';
import { preparationFailed, preparationReady, runnablePreparation } from '@/modules/content/infra/prisma/content-preparation.filters';
import { PublicationSchedule } from '../../domain/entities/content-scheduled.entity';
import { CLAIM_LEASE_MS, PUBLICATION_CRON_BATCH_SIZE, PUBLICATION_GRACE_MS, PUBLICATION_PREPARATION_MS } from '../../domain/entities/publication-timing';
import { ClaimedContentDraft, ContentScheduleRepository, SaveContentScheduleInput, ScheduledContentDraft } from '../../domain/repositories/content-schedule.repository';

export const pendingSchedule = { status: 'WAITING', socialAccountId: { not: null } } satisfies Prisma.ContentScheduledWhereInput;
const include = { publication: { select: { id: true, status: true, socialAccountId: true, caption: true } } } satisfies Prisma.ContentScheduledInclude;
type Row = Prisma.ContentScheduledGetPayload<{ include: typeof include }>;

@Injectable()
export class PrismaContentScheduleRepository implements ContentScheduleRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContext,
    private readonly contentRepository: PrismaContentRepository,
  ) {}

  async save (input: SaveContentScheduleInput, client: Prisma.TransactionClient = this.prisma): Promise<PublicationSchedule> {
    const schedule = await client.contentScheduled.create({ data: input });
    return this.toDomain({ ...schedule, publication: null });
  }

  async findById (id: string) {
    const companyId = this.requestContext.companyId;
    const row = await this.prisma.contentScheduled.findUnique({ where: { companyId_id: { companyId, id } }, include });
    return row && this.toDomain(row);
  }

  findEligibleDrafts () {
    return this.prisma.contentScheduled.findMany({
      where: this.eligibleDraft(new Date()),
      orderBy: [{ date: 'asc' }, { id: 'asc' }],
      take: PUBLICATION_CRON_BATCH_SIZE,
      select: { id: true },
    });
  }

  async claimDraft (id: string): Promise<ClaimedContentDraft | null> {
    const now = new Date();
    const leaseUntil = new Date(now.getTime() + CLAIM_LEASE_MS);
    const [row] = await this.prisma.contentScheduled.updateManyAndReturn({
      where: { id, ...this.eligibleDraft(now) },
      data: { contentCreationLeaseUntil: leaseUntil },
      select: { id: true, companyId: true, contentDraft: true },
    });
    return row ? { ...row, contentDraft: row.contentDraft as ScheduledContentDraft, leaseUntil } : null;
  }

  attachCreatedContent (job: ClaimedContentDraft, content: Content) {
    return this.prisma.serializable(async tx => {
      const claimed = await tx.contentScheduled.updateMany({
        where: this.ownedDraft(job),
        data: { contentCreationLeaseUntil: null },
      });
      if (!claimed.count) return false;

      await this.contentRepository.createInTransaction(content, tx);
      await tx.contentScheduled.update({
        where: { companyId_id: { companyId: job.companyId, id: job.id } },
        data: { contentId: content.id },
      });
      return true;
    });
  }

  failDraft (job: ClaimedContentDraft, error: string) {
    return this.markPendingFailed(this.ownedDraft(job), error);
  }

  async findEligibleContents () {
    const now = new Date();
    const deadline = new Date(now.getTime() - PUBLICATION_GRACE_MS);
    const date = { gt: deadline, lte: new Date(now.getTime() + PUBLICATION_PREPARATION_MS) };
    const legacy = { socialAccountId: null, status: { in: ['WAITING', 'READY'] } } satisfies Prisma.ContentScheduledWhereInput;
    const rows = await this.prisma.content.findMany({
      where: {
        OR: [
          {
            AND: [
              runnablePreparation(now),
              { schedules: { some: { date, OR: [pendingSchedule, legacy] } } },
            ],
          },
          {
            OR: [preparationReady, preparationFailed],
            schedules: { some: { ...pendingSchedule, date: { gt: deadline } } },
          },
        ],
      },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: PUBLICATION_CRON_BATCH_SIZE,
      select: { id: true, companyId: true, updatedAt: true },
    });
    return rows.map(({ id, companyId, updatedAt }) => ({ contentId: id, companyId, updatedAt }));
  }

  async failPreparation ({ companyId, contentId }: ContentPreparationInput, revision: number, error: string) {
    await this.markPendingFailed({
      ...pendingSchedule, companyId, contentId, content: { revision },
      date: { gt: new Date(Date.now() - PUBLICATION_GRACE_MS) },
    }, error);
  }

  async expireSchedules () {
    await this.markPendingFailed({
      ...pendingSchedule, date: { lte: new Date(Date.now() - PUBLICATION_GRACE_MS) },
    }, 'O prazo expirou antes de a preparação ficar pronta.');
  }

  private async markPendingFailed (where: Prisma.ContentScheduledWhereInput, error: string) {
    await this.prisma.serializable(async tx => {
      await tx.publication.updateMany({
        where: { status: 'SCHEDULED', schedule: where },
        data: { status: 'FAILED', error },
      });
      await tx.contentScheduled.updateMany({ where, data: { status: 'ERROR', preparationError: error, contentCreationLeaseUntil: null } });
    });
  }

  private eligibleDraft (now: Date): Prisma.ContentScheduledWhereInput {
    return {
      ...pendingSchedule,
      contentId: null,
      contentDraft: { not: Prisma.DbNull },
      publication: { is: { status: 'SCHEDULED' } },
      date: { gt: new Date(now.getTime() - PUBLICATION_GRACE_MS), lte: new Date(now.getTime() + PUBLICATION_PREPARATION_MS) },
      OR: [{ contentCreationLeaseUntil: null }, { contentCreationLeaseUntil: { lte: now } }],
    };
  }

  private ownedDraft (job: ClaimedContentDraft): Prisma.ContentScheduledWhereInput {
    const now = new Date();
    return {
      ...pendingSchedule, id: job.id, companyId: job.companyId, contentId: null,
      contentCreationLeaseUntil: { equals: job.leaseUntil, gt: now },
      date: { gt: new Date(now.getTime() - PUBLICATION_GRACE_MS) },
    };
  }

  private toDomain ({ publication, contentDraft: _draft, contentCreationLeaseUntil: _lease, ...schedule }: Row): PublicationSchedule {
    return {
      ...schedule, status: ContentStatus[schedule.status],
      socialAccountId: schedule.socialAccountId ?? publication?.socialAccountId ?? null,
      caption: schedule.caption ?? publication?.caption ?? null,
      publication: publication && { id: publication.id, status: publication.status },
    };
  }
}
