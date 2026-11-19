import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { VideoAsset as AssetRow, VideoGeneration as Row } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { AppError } from '@/shared/core/errors/app.error';
import { RequestContext } from '@/shared/core/request-context/request-context';
import { VideoAsset, VideoReview } from '../../domain/entities/video-asset.entity';
import { RenderInput, VideoGeneration } from '../../domain/entities/video-generation.entity';
import { RenderNotification } from '../../domain/providers/video.provider';
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
      if (existing && existing.status !== 'FAILED') return this.toDomain(existing);
      await tx.content.updateMany({
        where: { companyId, id: contentId, revision }, data: { status: 'WAITING', aiScript: input.script },
      });
      const row = existing
        ? await tx.videoGeneration.update({
            where: { id: existing.id }, data: { status: 'PENDING', submissionId: null, providerId: null, error: null, leaseUntil: null, input },
          })
        : await tx.videoGeneration.create({ data: { ...key, input } });
      return this.toDomain(row);
    });
  }

  async findCurrent(contentId: string, revision: number)
  {
    const companyId = this.requestContext.companyId;
    const row = await this.prismaService.videoGeneration.findUnique({ where: { companyId_contentId_revision: { companyId, contentId, revision } } });
    return row && this.toDomain(row);
  }

  async findById(id: string)
  {
    const row = await this.prismaService.videoGeneration.findFirst({
      where: { companyId: this.requestContext.companyId, id }, include: { video: true },
    });
    return row && { generation: this.toDomain(row), video: row.video && this.toAsset(row.video) };
  }

  async claimSubmission(generation: VideoGeneration)
  {
    const leaseUntil = new Date(Date.now() + 120_000);
    const submissionId = randomUUID();
    const changed = await this.prismaService.videoGeneration.updateMany({
      where: { id: generation.id, companyId: generation.companyId, status: 'PENDING' },
      data: { leaseUntil, submissionId, status: 'SUBMITTING' },
    });
    return changed.count ? { ...generation, status: 'SUBMITTING' as const, leaseUntil, submissionId } : null;
  }

  async submitted(generation: VideoGeneration, providerId: string)
  {
    await this.prismaService.videoGeneration.updateMany({
      where: this.owned(generation), data: { status: 'RENDERING', providerId, leaseUntil: null },
    });
  }

  async claimCompletion(notification: RenderNotification)
  {
    return this.prismaService.serializable(async tx => {
      const row = await tx.videoGeneration.findUnique({ where: { submissionId: notification.submissionId } });
      if (!row || (row.providerId && row.providerId !== notification.providerId)) return null;
      if (row.status === 'READY' || row.status === 'FAILED') return { generation: this.toDomain(row), claimed: false };
      if (row.status !== 'SUBMITTING' && row.status !== 'RENDERING') return null;
      if (row.status === 'RENDERING' && row.leaseUntil && row.leaseUntil.getTime() > Date.now()) {
        throw new AppError('unavailable', 'O resultado do render já está em processamento.');
      }
      const generation = await tx.videoGeneration.update({
        where: { id: row.id },
        data: { status: 'RENDERING', providerId: notification.providerId, leaseUntil: new Date(Date.now() + 600_000) },
      });
      return { generation: this.toDomain(generation), claimed: true };
    });
  }

  async release(generation: VideoGeneration)
  {
    await this.prismaService.videoGeneration.updateMany({ where: this.owned(generation), data: { leaseUntil: null } });
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
        where: { companyId: job.companyId, id: job.contentId, revision: job.revision }, data: { status: review.status === 'APPROVED' ? 'READY' : 'REPROVED' },
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
