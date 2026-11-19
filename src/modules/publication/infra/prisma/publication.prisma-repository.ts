import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { ContentStatus } from '@/modules/content/domain/entities/content-status';
import { RequestContext } from '@/shared/core/request-context/request-context';
import { AppError, requireRecord } from '@/shared/core/errors/app.error';
import { ContentScheduled } from '../../domain/entities/content-scheduled.entity';
import { Publication, PublicationWork } from '../../domain/entities/publication.entity';
import { PublicationRepository, ScheduleInput } from '../../domain/repositories/publication.repository';

const include = { schedule: true } satisfies Prisma.PublicationInclude;
type Row = Prisma.PublicationGetPayload<{ include: typeof include }>;
const active = { in: ['SCHEDULED', 'PUBLISHING'] as const };
const statuses = { in: [...active.in] };

@Injectable()
export class PrismaPublicationRepository implements PublicationRepository {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly requestContext: RequestContext,
  ) { }

  create(input: ScheduleInput)
  {
    const companyId = this.requestContext.companyId;
    const { date, contentId, videoId, socialAccountId } = input;

    return this.prismaService.serializable(async tx => {

      const video = requireRecord(await tx.videoAsset.findUnique({
        where: { companyId_contentId_id: { companyId, contentId, id: videoId } }, include: { content: true },
      }), 'Vídeo');

      ContentScheduled.validate(
        date, ContentStatus[video.content.status], video.content.revision, ContentStatus[video.reviewStatus], video.revision,
      );

      const account = requireRecord(await tx.socialAccount.findUnique({
        where: { companyId_id: { companyId, id: socialAccountId } },
        include: {
          credentials:
          {
            where: { kind: 'access_token' },
            select: { expiresAt: true }
          }
        },
      }), 'Conta social');

      if (account.status !== 'ACTIVE' || !account.credentials.some(token => token.expiresAt && token.expiresAt > date)) {
        throw new AppError('conflict', 'Conecte uma conta com credencial válida na data programada.');
      }

      const editorial = video.content.editorial as { caption?: string };
      
      const schedule = await tx.contentScheduled.create({ 
        data: { companyId, contentId, videoId, date } 
      });

      const publication = await tx.publication.create({
        data: { companyId, scheduleId: schedule.id, socialAccountId, caption: input.caption ?? editorial.caption, nextAttemptAt: date }, include,
      });

      return this.toDomain(publication);
    });
  }

  async findById(id: string)
  {
    const row = await this.prismaService.publication.findFirst({ where: { companyId: this.requestContext.companyId, id }, include });
    return row && this.toDomain(row);
  }

  pendingJobs()
  {
    const now = new Date();
    return this.prismaService.publication.findMany({
      where: { status: statuses, nextAttemptAt: { lte: new Date(now.getTime() + 15 * 60_000) }, ...this.available(now) },
      orderBy: { nextAttemptAt: 'asc' }, take: 200, select: { id: true, nextAttemptAt: true },
    });
  }

  async claim(id: string): Promise<PublicationWork | null>
  {
    const now = new Date();
    const leaseUntil = new Date(now.getTime() + 180_000);
    return this.prismaService.$transaction(async tx => {
      const claimed = await tx.publication.updateMany({
        where: { id, status: statuses, nextAttemptAt: { lte: now }, ...this.available(now) }, data: { status: 'PUBLISHING', leaseUntil },
      });
      if (!claimed.count) return null;
      const row = await tx.publication.findUniqueOrThrow({
        where: { id },
        include: {
          schedule: { include: { content: true, video: true } },
          socialAccount: { include: { credentials: { where: { kind: 'access_token' }, take: 1 } } },
        },
      });
      const { content, video } = row.schedule;
      return {
        ...this.toDomain(row), leaseUntil,
        approved: content.status === 'APPROVED' && video.reviewStatus === 'APPROVED' && content.revision === video.revision,
        videoKey: video.storageKey, accountExternalId: row.socialAccount.externalId, accountActive: row.socialAccount.status === 'ACTIVE',
        credential: row.socialAccount.credentials[0] ?? null,
      };
    });
  }

  async defer(job: PublicationWork, containerId?: string)
  {
    await this.prismaService.publication.updateMany({
      where: this.owned(job), data: { leaseUntil: null, containerId, nextAttemptAt: new Date(Date.now() + 60_000) },
    });
  }

  succeed(job: PublicationWork, externalId?: string)
  {
    return this.finish(job, { status: 'PUBLISHED', externalId }, 'APPROVED');
  }

  fail(job: PublicationWork, error: string)
  {
    return this.finish(job, { status: 'FAILED', error }, 'ERROR');
  }

  private async finish(job: PublicationWork, data: Prisma.PublicationUpdateManyMutationInput, status: 'APPROVED' | 'ERROR')
  {
    await this.prismaService.$transaction(async tx => {
      const changed = await tx.publication.updateMany({ where: this.owned(job), data: { ...data, leaseUntil: null } });
      if (changed.count) await tx.contentScheduled.update({
        where: { companyId_id: { companyId: job.companyId, id: job.schedule.id } }, data: { status },
      });
    });
  }

  private available(now: Date)
  { return { OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }] }; }
  private owned(job: PublicationWork)
  { return { id: job.id, companyId: job.companyId, leaseUntil: job.leaseUntil }; }

  private toDomain(row: Row): Publication
  {
    const { id, companyId, status, socialAccountId, caption, containerId, externalId, error, schedule } = row;
    return {
      id, companyId, status, socialAccountId, caption, containerId, externalId, error,
      schedule: new ContentScheduled(
        schedule.id, companyId, schedule.contentId, schedule.videoId, schedule.date, ContentStatus[schedule.status], schedule.createdAt, schedule.updatedAt,
      ),
    };
  }
}
