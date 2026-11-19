import { VideoAsset } from '../entities/video-asset.entity';
import { RenderInput, VideoGeneration } from '../entities/video-generation.entity';

export abstract class VideoGenerationRepository {
  abstract create(contentId: string, revision: number, input: RenderInput): Promise<VideoGeneration>;
  abstract findById(id: string): Promise<{ generation: VideoGeneration; video: VideoAsset | null } | null>;
  abstract claim(): Promise<VideoGeneration | null>;
  abstract submitted(generation: VideoGeneration, providerId: string): Promise<void>;
  abstract postpone(generation: VideoGeneration, delayMs: number): Promise<void>;
  abstract fail(generation: VideoGeneration, message: string): Promise<void>;
  abstract complete(generation: VideoGeneration, video: VideoAsset): Promise<void>;
}
