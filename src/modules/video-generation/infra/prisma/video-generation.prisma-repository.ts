import { Injectable } from '@nestjs/common';
import type { VideoAsset as AssetRow, VideoGeneration as Row } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { AppError } from '@/shared/core/errors/app.error';
import { RequestContext } from '@/shared/core/request-context/request-context';
import { VideoAsset, VideoReview } from '../../domain/entities/video-asset.entity';
import { RenderInput, VideoGeneration } from '../../domain/entities/video-generation.entity';
import { VideoGenerationRepository } from '../../domain/repositories/video-generation.repository';

@Injectable()
export class PrismaVideoGenerationRepository implements VideoGenerationRepository {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly requestContext: RequestContext,
  ) {}

  create(contentId: string, revision: number, input: RenderInput)
  {
    const companyId = this.requestContext.companyId;
    return this.prismaService.serializable(async tx => {
      const content = await tx.content.findUnique({ where: { companyId_id: { companyId, id: contentId } }, select: { revision: true } });
      if (content?.revision !== revision) throw new AppError('conflict', 'O conteúdo mudou antes de solicitar o render.');
      const key = { companyId, contentId, revision };
      const existing = await tx.videoGeneration.findUnique({ where: { companyId_contentId_revision: key } });
      if (existing?.status === 'FAILED') {
        await tx.content.updateMany({ where: { companyId, id: contentId, revision }, data: { status: 'WAITING' } });
        return this.toDomain(await tx.videoGeneration.update({
          where: { id: existing.id }, data: {
            status: 'PENDING', providerId: null, error: null, leaseUntil: null, nextCheckAt: new Date(), createdAt: new Date(), input,
          },
        }));
      }
      return this.toDomain(existing ?? await tx.videoGeneration.create({ data: { ...key, input } }));
    });
  }

  async findById(id: string)
  {
    const row = await this.prismaService.videoGeneration.findFirst({
      where: { companyId: this.requestContext.companyId, id }, include: { video: true },
    });
    return row && { generation: this.toDomain(row), video: row.video && this.toAsset(row.video) };
  }

  async claim()
  {
    const now = new Date();
    const available = {
      status: { in: ['PENDING', 'SUBMITTING', 'RENDERING'] as ('PENDING' | 'SUBMITTING' | 'RENDERING')[] },
      nextCheckAt: { lte: now }, OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }],
    };
    const row = await this.prismaService.videoGeneration.findFirst({ where: available, orderBy: { nextCheckAt: 'asc' } });
    if (!row) return null;
    const leaseUntil = new Date(now.getTime() + (row.status === 'RENDERING' ? 600_000 : 120_000));
    const claimed = await this.prismaService.videoGeneration.updateMany({
      where: { ...available, id: row.id, status: row.status },
      data: { leaseUntil, status: row.status === 'PENDING' ? 'SUBMITTING' : row.status },
    });
    return claimed.count ? this.toDomain({ ...row, leaseUntil }) : null;
  }

  async submitted(job: VideoGeneration, providerId: string)
  {
    await this.prismaService.videoGeneration.updateMany({
      where: this.owned(job), data: { status: 'RENDERING', providerId, leaseUntil: null, nextCheckAt: new Date(Date.now() + 5000) },
    });
  }

  async postpone(job: VideoGeneration, delayMs: number)
  {
    await this.prismaService.videoGeneration.updateMany({
      where: this.owned(job), data: { leaseUntil: null, nextCheckAt: new Date(Date.now() + delayMs) },
    });
  }

  async fail(job: VideoGeneration, message: string)
  {
    await this.prismaService.$transaction(async tx => {
      const changed = await tx.videoGeneration.updateMany({ where: this.owned(job), data: { status: 'FAILED', error: message, leaseUntil: null } });
      if (changed.count) await tx.content.updateMany({
        where: { companyId: job.companyId, id: job.contentId, revision: job.revision }, data: { status: 'ERROR' },
      });
    });
  }

  async complete(job: VideoGeneration, video: VideoAsset)
  {
    await this.prismaService.$transaction(async tx => {
      const changed = await tx.videoGeneration.updateMany({ where: this.owned(job), data: { status: 'READY', leaseUntil: null } });
      if (!changed.count) return;
      const { review, ...data } = video;
      await tx.videoAsset.create({ data: { ...data, reviewStatus: review.status, review } });
      await tx.content.updateMany({
        where: { companyId: job.companyId, id: job.contentId, revision: job.revision }, data: { status: review.status },
      });
    });
  }

  private owned(job: VideoGeneration)
  { return { id: job.id, companyId: job.companyId, leaseUntil: job.leaseUntil }; }
  private toDomain(row: Row): VideoGeneration
  { return { ...row, input: row.input as RenderInput }; }
  private toAsset(row: AssetRow)
  {
    return new VideoAsset(row.id, row.companyId, row.contentId, row.generationId, row.revision, row.storageKey, row.review as VideoReview);
  }
}
