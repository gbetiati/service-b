import { Injectable } from '@nestjs/common';
import { VideoSubtitlesProvider } from '../../domain/providers/video-subtitles.provider';
import { SubtitleTarget, VideoSubtitlesRepository } from '../../domain/repositories/video-subtitles.repository';

@Injectable()
export class BurnVideoSubtitlesUseCase {
  constructor(
    private readonly videoSubtitlesRepository: VideoSubtitlesRepository,
    private readonly videoSubtitlesProvider: VideoSubtitlesProvider,
  ) {}

  async execute (input: SubtitleTarget) {
    const job = await this.videoSubtitlesRepository.claim(input);
    if (!job) return { status: 'PENDING' } as const;

    let outputKey: string;
    try {
      outputKey = await this.videoSubtitlesProvider.burn(job.storageKey, job.srt);
    } catch (error) {
      await this.videoSubtitlesRepository.finish(job, null);
      throw error;
    }
    await this.videoSubtitlesRepository.finish(job, outputKey);
    return { status: 'READY' } as const;
  }
}
