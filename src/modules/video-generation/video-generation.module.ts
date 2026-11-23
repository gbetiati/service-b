import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AiModule } from '@/shared/libs/ai/ai.module';
import { ExternalApiModule } from '@/shared/libs/http/external-api.module';
import { StorageModule } from '@/shared/libs/storage/storage.module';
import { ContentModule } from '../content/content.module';
import { GenerateVideoUseCase } from './application/use-cases/generate-video.usecase';
import { GetVideoGenerationStatusUseCase } from './application/use-cases/get-video-generation-status.usecase';
import { CompleteScriptGenerationUseCase } from './application/use-cases/complete-script-generation.usecase';
import { CompleteVideoGenerationUseCase } from './application/use-cases/complete-video-generation.usecase';
import { BurnVideoSubtitlesUseCase } from './application/use-cases/burn-video-subtitles.usecase';
import { VideoSubtitlesProvider } from './domain/providers/video-subtitles.provider';
import { VideoSubtitlesRepository } from './domain/repositories/video-subtitles.repository';
import { PrismaVideoSubtitlesRepository } from './infra/prisma/video-subtitles.prisma-repository';
import { FfmpegVideoSubtitlesProvider } from './infra/providers/ffmpeg-video-subtitles.provider';
import { TranscribeVideoUseCase } from './application/use-cases/transcribe-video.usecase';
import { VideoTranscriptionProvider } from './domain/providers/video-transcription.provider';
import { VideoTranscriptionRepository } from './domain/repositories/video-transcription.repository';
import { PrismaVideoTranscriptionRepository } from './infra/prisma/video-transcription.prisma-repository';
import { ReplicateWhisperProvider } from './infra/providers/replicate-whisper.provider';
import { VIDEO_RENDER_PROVIDER, VideoProvider } from './domain/providers/video.provider';
import { VideoReviewProvider } from './domain/providers/video-review.provider';
import { VideoGenerationRepository } from './domain/repositories/video-generation.repository';
import { ReplicateWebhookController } from './infra/controllers/replicate-webhook.controller';
import { ReplicateH3LiteProvider } from './infra/providers/replicate-h3-lite.provider';
import { VideoGenerationController } from './infra/controllers/video-generation.controller';
import { PrismaVideoGenerationRepository } from './infra/prisma/video-generation.prisma-repository';
import { CreatomateProvider } from './infra/providers/creatomate.provider';
import { MultimodalVideoReviewProvider } from './infra/providers/multimodal-video-review.provider';

@Module({
  imports: [ConfigModule, ContentModule, StorageModule, ExternalApiModule, AiModule],
  controllers: [VideoGenerationController, ReplicateWebhookController],
  exports: [GenerateVideoUseCase, CompleteScriptGenerationUseCase, CompleteVideoGenerationUseCase, TranscribeVideoUseCase, BurnVideoSubtitlesUseCase],
  providers: [
    GenerateVideoUseCase, GetVideoGenerationStatusUseCase, CompleteScriptGenerationUseCase, CompleteVideoGenerationUseCase,
    TranscribeVideoUseCase, BurnVideoSubtitlesUseCase,
    { provide: VideoSubtitlesRepository, useClass: PrismaVideoSubtitlesRepository },
    { provide: VideoSubtitlesProvider, useClass: FfmpegVideoSubtitlesProvider },
    { provide: VideoTranscriptionRepository, useClass: PrismaVideoTranscriptionRepository },
    { provide: VideoTranscriptionProvider, useClass: ReplicateWhisperProvider },
    { provide: VideoGenerationRepository, useClass: PrismaVideoGenerationRepository },
    { provide: VideoProvider, useClass: CreatomateProvider },
    ReplicateH3LiteProvider,
    {
      provide: VIDEO_RENDER_PROVIDER,
      inject: [ConfigService, VideoProvider, ReplicateH3LiteProvider],
      useFactory: (config: ConfigService, creatomate: VideoProvider, replicate: ReplicateH3LiteProvider) => {
        const provider = config.get<string>('VIDEO_PROVIDER')?.trim() || 'creatomate';
        if (provider !== 'creatomate' && provider !== 'replicate-h3-lite') {
          throw new Error('VIDEO_PROVIDER deve ser creatomate ou replicate-h3-lite.');
        }
        new Logger(VideoGenerationModule.name).log(`Provedor para novos renders: ${provider}`);
        return provider === 'replicate-h3-lite' ? replicate : creatomate;
      },
    },
    { provide: VideoReviewProvider, useClass: MultimodalVideoReviewProvider },
  ],
})
export class VideoGenerationModule {}
