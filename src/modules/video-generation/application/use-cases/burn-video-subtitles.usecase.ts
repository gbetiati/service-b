import { Injectable } from '@nestjs/common';
import { VideoSubtitlesProvider } from '../../domain/providers/video-subtitles.provider';
import { VideoSubtitlesRepository } from '../../domain/repositories/video-subtitles.repository';

@Injectable()
export class BurnVideoSubtitlesUseCase {
  constructor(
    private readonly repository: VideoSubtitlesRepository,
    private readonly provider: VideoSubtitlesProvider,
  ) {}

  async execute (input: Parameters<VideoSubtitlesRepository['claim']>[0]) {
    const job = await this.repository.claim(input);
    if (!job) return { status: 'PENDING' } as const;

    let outputKey: string;
    try {
      outputKey = await this.provider.burn(job.storageKey, job.srt);
    } catch (error) {
      await this.repository.finish(job, null);
      throw error;
    }
    await this.repository.finish(job, outputKey);
    return { status: 'READY' } as const;
  }
}
