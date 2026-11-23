import { Injectable } from '@nestjs/common';
import { StorageProvider } from '@/shared/libs/storage/storage.provider';
import { VideoTranscriptionProvider } from '../../domain/providers/video-transcription.provider';
import { VideoTranscriptionRepository } from '../../domain/repositories/video-transcription.repository';

@Injectable()
export class TranscribeVideoUseCase {
  constructor(
    private readonly repository: VideoTranscriptionRepository,
    private readonly videoTranscriptionProvider: VideoTranscriptionProvider,
    private readonly storageProvider: StorageProvider,
  ) {}

  async execute (input: Parameters<VideoTranscriptionRepository['claim']>[0]) {
    const job = await this.repository.claim(input);
    if (!job) return { status: 'PENDING' } as const;

    try {
      await this.videoTranscriptionProvider.transcribe(job.submissionId, await this.storageProvider.url(job.storageKey, 3600));
    } catch (error) {
      await this.complete(job.submissionId, null);
      throw error;
    }

    return { status: 'PENDING' } as const;
  }

  complete (submissionId: string, srt: string | null) {
    if (srt === null) return this.repository.finish(submissionId, null);

    const normalized = srt.trim().replace(/\r\n/g, '\n');
    const cues = normalized ? normalized.split(/\n[ \t]*\n/) : [];
    const lines = cues.map(cue => cue.split('\n'));
    const timing = /^\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}$/;
    if (lines.some(([index, range, text]) => !/^\d+$/.test(index) || !timing.test(range) || !text)) {
      return this.repository.finish(submissionId, null);
    }

    const text = lines.map(cue => cue.slice(2).join(' ')).join(' ');
    return this.repository.finish(submissionId, { text, srt: normalized ? normalized + '\n' : '' });
  }
}
