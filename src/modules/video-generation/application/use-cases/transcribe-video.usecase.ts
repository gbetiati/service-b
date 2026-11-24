import { Injectable } from '@nestjs/common';
import { StorageProvider } from '@/shared/libs/storage/storage.provider';
import { parseSrtTranscript } from '../../domain/entities/transcript';
import { VideoTranscriptionProvider } from '../../domain/providers/video-transcription.provider';
import { TranscriptionTarget, VideoTranscriptionRepository } from '../../domain/repositories/video-transcription.repository';

const VIDEO_URL_TTL_SECONDS = 3600;

@Injectable()
export class TranscribeVideoUseCase {
  constructor(
    private readonly videoTranscriptionRepository: VideoTranscriptionRepository,
    private readonly videoTranscriptionProvider: VideoTranscriptionProvider,
    private readonly storageProvider: StorageProvider,
  ) {}

  async execute (input: TranscriptionTarget) {
    const job = await this.videoTranscriptionRepository.claim(input);
    if (!job) return { status: 'PENDING' } as const;

    try {
      await this.videoTranscriptionProvider.transcribe(job.submissionId, await this.storageProvider.url(job.storageKey, VIDEO_URL_TTL_SECONDS));
    } catch (error) {
      await this.complete(job.submissionId, null);
      throw error;
    }

    return { status: 'PENDING' } as const;
  }

  // Chamado pelo webhook do provedor. `srt` nulo indica falha na transcrição.
  complete (submissionId: string, srt: string | null) {
    return this.videoTranscriptionRepository.finish(submissionId, srt === null ? null : parseSrtTranscript(srt));
  }
}
