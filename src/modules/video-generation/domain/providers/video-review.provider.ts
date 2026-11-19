import type { Readable } from 'node:stream';
import { VideoReview } from '../entities/video-asset.entity';
import { RenderInput } from '../entities/video-generation.entity';

export abstract class VideoReviewProvider {
  abstract review (video: Readable, input: RenderInput, references: string[]): Promise<VideoReview>;
}
