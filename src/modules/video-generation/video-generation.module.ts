import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { StorageModule } from '@/shared/libs/storage/storage.module';
import { ContentModule } from '../content/content.module';
import { ProductModule } from '../product/product.module';
import { CompleteScriptGenerationUseCase } from './application/use-cases/complete-script-generation.usecase';
import { CompleteVideoGenerationUseCase } from './application/use-cases/complete-video-generation.usecase';
import { GenerateVideoUseCase } from './application/use-cases/generate-video.usecase';
import { GetVideoGenerationStatusUseCase } from './application/use-cases/get-video-generation-status.usecase';
import { CopyWriterProvider } from './domain/providers/copy-writer.provider';
import { SpeechProvider } from './domain/providers/speech.provider';
import { TranscriptionProvider } from './domain/providers/transcription.provider';
import { VideoProvider } from './domain/providers/video.provider';
import { VideoGenerationRepository } from './domain/repositories/video-generation.repository';
import { ClaudeScriptWebhookController } from './infra/controllers/claude-script-webhook.controller';
import { RemotionWebhookController } from './infra/controllers/remotion-webhook.controller';
import { VideoGenerationController } from './infra/controllers/video-generation.controller';
import { PrismaVideoGenerationRepository } from './infra/prisma/video-generation.prisma-repository';
// TESTE (mock): reative junto com o binding do Claude abaixo.
// import { ClaudeCopyWriterProvider } from './infra/providers/claude-copy-writer.provider';
import { MockCopyWriterProvider } from './infra/providers/mock-copy-writer.provider';
import { OpenAiSpeechProvider } from './infra/providers/openai-speech.provider';
import { OpenAiTranscriptionProvider } from './infra/providers/openai-transcription.provider';
import { RemotionVideoProvider } from './infra/providers/remotion.provider';
import { VoiceClipTools } from './infra/remotion/voice-clip.tools';
import { RemotionCliRenderer } from './infra/remotion/remotion-cli.renderer';
import { RemotionWebhookClient } from './infra/remotion/remotion-webhook.client';
import { RemotionSettings } from './infra/remotion/remotion.settings';
import { RenderSemaphore } from './infra/remotion/render-semaphore';

// O vídeo é montado pelo Remotion. A aplicação não sobe sem a configuração dele.
function remotionVideoProvider (remotion: RemotionVideoProvider): VideoProvider {
  remotion.assertConfigured();
  return remotion;
}

@Module({
  imports: [ConfigModule, ContentModule, ProductModule, StorageModule],
  controllers: [VideoGenerationController, RemotionWebhookController, ClaudeScriptWebhookController],
  providers: [
    GenerateVideoUseCase, GetVideoGenerationStatusUseCase, CompleteScriptGenerationUseCase, CompleteVideoGenerationUseCase,
    RemotionVideoProvider, RemotionCliRenderer, RemotionWebhookClient, VoiceClipTools,
    // Locução dos anúncios (TTS). Só é chamada quando o conteúdo pede voz.
    { provide: SpeechProvider, useClass: OpenAiSpeechProvider },
    // Confere a locução gravada numa tomada só e acha onde cortar cada trecho.
    { provide: TranscriptionProvider, useClass: OpenAiTranscriptionProvider },
    { provide: VideoGenerationRepository, useClass: PrismaVideoGenerationRepository },
    { provide: VideoProvider, inject: [RemotionVideoProvider], useFactory: remotionVideoProvider },
    // TESTE (mock): copy simulada enquanto não há ANTHROPIC_API_KEY.
    // { provide: CopyWriterProvider, useClass: ClaudeCopyWriterProvider },
    { provide: CopyWriterProvider, useClass: MockCopyWriterProvider },
    { provide: RemotionSettings, inject: [ConfigService], useFactory: (config: ConfigService) => RemotionSettings.fromEnv(config) },
    { provide: RenderSemaphore, inject: [RemotionSettings], useFactory: (settings: RemotionSettings) => new RenderSemaphore(settings.maxConcurrentRenders) },
  ],
  exports: [GenerateVideoUseCase],
})
export class VideoGenerationModule {}
