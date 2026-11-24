import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AiModule } from '@/shared/libs/ai/ai.module';
import { ExternalApiModule } from '@/shared/libs/http/external-api.module';
import { StorageModule } from '@/shared/libs/storage/storage.module';
import { ContentModule } from '../content/content.module';
import { ProductModule } from '../product/product.module';
import { BurnVideoSubtitlesUseCase } from './application/use-cases/burn-video-subtitles.usecase';
import { CompleteScriptGenerationUseCase } from './application/use-cases/complete-script-generation.usecase';
import { CompleteVideoGenerationUseCase } from './application/use-cases/complete-video-generation.usecase';
import { GenerateVideoUseCase } from './application/use-cases/generate-video.usecase';
import { GetVideoGenerationStatusUseCase } from './application/use-cases/get-video-generation-status.usecase';
import { TranscribeVideoUseCase } from './application/use-cases/transcribe-video.usecase';
import { CopyWriterProvider } from './domain/providers/copy-writer.provider';
import { VIDEO_RENDER_PROVIDER, VideoProvider } from './domain/providers/video.provider';
import { VideoReviewProvider } from './domain/providers/video-review.provider';
import { VideoSubtitlesProvider } from './domain/providers/video-subtitles.provider';
import { VideoTranscriptionProvider } from './domain/providers/video-transcription.provider';
import { VideoGenerationRepository } from './domain/repositories/video-generation.repository';
import { VideoSubtitlesRepository } from './domain/repositories/video-subtitles.repository';
import { VideoTranscriptionRepository } from './domain/repositories/video-transcription.repository';
import { CreatomateWebhookController } from './infra/controllers/creatomate-webhook.controller';
import { OpenAiWebhookController } from './infra/controllers/open-ai-webhook.controller';
import { RemotionWebhookController } from './infra/controllers/remotion-webhook.controller';
import { ReplicateWebhookController } from './infra/controllers/replicate-webhook.controller';
import { VideoGenerationController } from './infra/controllers/video-generation.controller';
import { PrismaVideoGenerationRepository } from './infra/prisma/video-generation.prisma-repository';
import { PrismaVideoSubtitlesRepository } from './infra/prisma/video-subtitles.prisma-repository';
import { PrismaVideoTranscriptionRepository } from './infra/prisma/video-transcription.prisma-repository';
// TESTE (mock): reative junto com o binding do Claude abaixo.
// import { ClaudeCopyWriterProvider } from './infra/providers/claude-copy-writer.provider';
import { CreatomateProvider } from './infra/providers/creatomate.provider';
import { MockCopyWriterProvider } from './infra/providers/mock-copy-writer.provider';
import { FfmpegVideoSubtitlesProvider } from './infra/providers/ffmpeg-video-subtitles.provider';
import { MultimodalVideoReviewProvider } from './infra/providers/multimodal-video-review.provider';
import { RemotionVideoProvider } from './infra/providers/remotion.provider';
import { ReplicateH3LiteProvider } from './infra/providers/replicate-h3-lite.provider';
import { ReplicateWhisperProvider } from './infra/providers/replicate-whisper.provider';
import { RemotionCliRenderer } from './infra/remotion/remotion-cli.renderer';
import { RemotionWebhookClient } from './infra/remotion/remotion-webhook.client';
import { RemotionSettings } from './infra/remotion/remotion.settings';
import { RenderSemaphore } from './infra/remotion/render-semaphore';

const renderProviders = ['creatomate', 'replicate-h3-lite', 'remotion'] as const;

type RenderProviders = { creatomate: VideoProvider; replicate: ReplicateH3LiteProvider; remotion: RemotionVideoProvider };

// VideoProvider é sempre o Creatomate (usado para concluir renders já enviados a ele).
// VIDEO_RENDER_PROVIDER é o provedor escolhido em VIDEO_PROVIDER para os novos renders.
function selectRenderProvider (config: ConfigService, { creatomate, replicate, remotion }: RenderProviders) {
  const provider = config.get<string>('VIDEO_PROVIDER')?.trim() || 'creatomate';

  if (!(renderProviders as readonly string[]).includes(provider)) throw new Error('VIDEO_PROVIDER deve ser creatomate, replicate-h3-lite ou remotion.');

  if (provider === 'remotion') remotion.assertConfigured();

  new Logger(VideoGenerationModule.name).log(`Provedor para novos renders: ${provider}`);
  return { creatomate, 'replicate-h3-lite': replicate, remotion }[provider as (typeof renderProviders)[number]];
}

@Module({
  imports: [ConfigModule, ContentModule, ProductModule, StorageModule, ExternalApiModule, AiModule],
  controllers: [VideoGenerationController, ReplicateWebhookController, OpenAiWebhookController, CreatomateWebhookController, RemotionWebhookController],
  providers: [
    GenerateVideoUseCase, GetVideoGenerationStatusUseCase, CompleteScriptGenerationUseCase, CompleteVideoGenerationUseCase,
    TranscribeVideoUseCase, BurnVideoSubtitlesUseCase, ReplicateH3LiteProvider, RemotionVideoProvider, RemotionCliRenderer, RemotionWebhookClient,
    { provide: VideoGenerationRepository, useClass: PrismaVideoGenerationRepository },
    { provide: VideoSubtitlesRepository, useClass: PrismaVideoSubtitlesRepository },
    { provide: VideoTranscriptionRepository, useClass: PrismaVideoTranscriptionRepository },
    { provide: VideoSubtitlesProvider, useClass: FfmpegVideoSubtitlesProvider },
    { provide: VideoTranscriptionProvider, useClass: ReplicateWhisperProvider },
    { provide: VideoReviewProvider, useClass: MultimodalVideoReviewProvider },
    { provide: VideoProvider, useClass: CreatomateProvider },
    // TESTE (mock): copy simulada enquanto não há ANTHROPIC_API_KEY.
    // { provide: CopyWriterProvider, useClass: ClaudeCopyWriterProvider },
    { provide: CopyWriterProvider, useClass: MockCopyWriterProvider },
    { provide: RemotionSettings, inject: [ConfigService], useFactory: (config: ConfigService) => RemotionSettings.fromEnv(config) },
    { provide: RenderSemaphore, inject: [RemotionSettings], useFactory: (settings: RemotionSettings) => new RenderSemaphore(settings.maxConcurrentRenders) },
    {
      provide: VIDEO_RENDER_PROVIDER,
      inject: [ConfigService, VideoProvider, ReplicateH3LiteProvider, RemotionVideoProvider],
      useFactory: (config: ConfigService, creatomate: VideoProvider, replicate: ReplicateH3LiteProvider, remotion: RemotionVideoProvider) =>
        selectRenderProvider(config, { creatomate, replicate, remotion }),
    },
  ],
  exports: [GenerateVideoUseCase, TranscribeVideoUseCase, BurnVideoSubtitlesUseCase],
})
export class VideoGenerationModule {}
