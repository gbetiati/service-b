import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { RequestContext } from '@/shared/core/request-context/request-context';
import type { ContentPreparationInput } from '@/modules/content/domain/repositories/content-preparation.repository';
import { ContentStatus } from '@/modules/content/domain/entities/content-status';
import { preparationFailed, preparationReady, runnablePreparation } from '@/modules/content/infra/prisma/content-preparation.filters';
import { PublicationSchedule } from '../../domain/entities/content-scheduled.entity';
import { PUBLICATION_CRON_BATCH_SIZE, PUBLICATION_GRACE_MS, PUBLICATION_PREPARATION_MS } from '../../domain/entities/publication-timing';
import { ContentScheduleRepository, SaveContentScheduleInput } from '../../domain/repositories/content-schedule.repository';

export const pendingSchedule = { status: 'WAITING', socialAccountId: { not: null } } satisfies Prisma.ContentScheduledWhereInput;
const include = { publication: { select: { id: true, status: true, socialAccountId: true, caption: true } } } satisfies Prisma.ContentScheduledInclude;
type Row = Prisma.ContentScheduledGetPayload<{ include: typeof include }>;

@Injectable()
export class PrismaContentScheduleRepository implements ContentScheduleRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContext,
  ) {}

  async save (input: SaveContentScheduleInput, client: Prisma.TransactionClient = this.prisma): Promise<PublicationSchedule> {
    const schedule = await client.contentScheduled.create({ data: input });
    return { ...schedule, status: ContentStatus[schedule.status], publication: null };
  }

  async findById (id: string) {
    const companyId = this.requestContext.companyId;
    const row = await this.prisma.contentScheduled.findUnique({ where: { companyId_id: { companyId, id } }, include });
    return row && this.toDomain(row);
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
    await this.prisma.contentScheduled.updateMany({
      where: {
        ...pendingSchedule, companyId, contentId, content: { revision },
        date: { gt: new Date(Date.now() - PUBLICATION_GRACE_MS) },
      },
      data: { status: 'ERROR', preparationError: error },
    });
  }

  async expireSchedules () {
    await this.prisma.contentScheduled.updateMany({
      where: { ...pendingSchedule, date: { lte: new Date(Date.now() - PUBLICATION_GRACE_MS) } },
      data: { status: 'ERROR', preparationError: 'O prazo expirou antes de a preparação ficar pronta.' },
    });
  }

  private toDomain ({ publication, ...schedule }: Row): PublicationSchedule {
    return {
      ...schedule, status: ContentStatus[schedule.status],
      socialAccountId: schedule.socialAccountId ?? publication?.socialAccountId ?? null,
      caption: schedule.caption ?? publication?.caption ?? null,
      publication: publication && { id: publication.id, status: publication.status },
    };
  }
}
