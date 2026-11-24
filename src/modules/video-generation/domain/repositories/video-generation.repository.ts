import type { ScriptResult } from '@/modules/content/domain/providers/script.provider';
import { VideoAsset } from '../entities/video-asset.entity';
import { RenderInput, VideoGeneration } from '../entities/video-generation.entity';
import { RenderResult } from '../providers/video.provider';

export abstract class VideoGenerationRepository {
  abstract create (contentId: string, revision: number, input: RenderInput, retryFailed: boolean, initialStatus?: 'PENDING_SCRIPT' | 'PENDING'): Promise<VideoGeneration>;

  abstract findCurrent (contentId: string, revision: number): Promise<VideoGeneration | null>;

  abstract findById (id: string): Promise<{ generation: VideoGeneration; video: VideoAsset | null; captionedStorageKey?: string | null } | null>;

  abstract claimScriptSubmission (generation: VideoGeneration): Promise<(VideoGeneration & { scriptSubmissionId: string }) | null>;

  abstract scriptSubmitted (generation: VideoGeneration): Promise<void>;

  abstract completeScript (scriptResult: ScriptResult): Promise<VideoGeneration | null>;

  abstract claimSubmission (generation: VideoGeneration): Promise<(VideoGeneration & { submissionId: string }) | null>;

  abstract submitted (generation: VideoGeneration, providerId: string): Promise<void>;

  abstract claimCompletion (renderResult: RenderResult): Promise<{ generation: VideoGeneration; claimed: boolean } | null>;

  abstract release (generation: VideoGeneration): Promise<void>;

  abstract fail (generation: VideoGeneration, message: string, stage?: 'script' | 'video'): Promise<void>;

  abstract complete (generation: VideoGeneration, video: VideoAsset, narrated?: boolean): Promise<void>;
}
