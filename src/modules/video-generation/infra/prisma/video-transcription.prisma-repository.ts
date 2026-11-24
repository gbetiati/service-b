import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AppError } from '@/shared/core/errors/app.error';
import type { Transcript } from '../../domain/entities/transcript';
import { TranscriptionTarget, VideoTranscriptionRepository } from '../../domain/repositories/video-transcription.repository';

@Injectable()
export class PrismaVideoTranscriptionRepository implements VideoTranscriptionRepository {
  constructor(private readonly prisma: PrismaService) {}

  claim ({ companyId, contentId, revision }: TranscriptionTarget) {
    const submissionId = randomUUID();

    return this.prisma.$transaction(async tx => {
      const changed = await tx.content.updateMany({
        where: { id: contentId, companyId, revision, videoStatus: 'READY', transcriptionStatus: 'NOT_STARTED' },
        data: { transcriptionSubmissionId: submissionId, transcriptionStatus: 'PENDING' },
      });
      if (!changed.count) return null;

      const render = await tx.videoGeneration.findUnique({
        where: { companyId_contentId_revision: { companyId, contentId, revision } },
        select: { video: { select: { storageKey: true } } },
      });
      if (!render?.video) throw new AppError('invalid', 'O vídeo da revisão atual não foi encontrado.');

      return { submissionId, storageKey: render.video.storageKey };
    });
  }

  async finish (submissionId: string, result: Transcript | null) {
    await this.prisma.content.updateMany({
      where: { transcriptionSubmissionId: submissionId, transcriptionStatus: 'PENDING' },
      data: { transcription: result?.text ?? null, subtitleSrt: result?.srt ?? null, transcriptionStatus: result ? 'READY' : 'FAILED' },
    });
  }
}
