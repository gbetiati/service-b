import { Module } from '@nestjs/common';
import { AiModule } from '@/shared/libs/ai/ai.module';
import { ExternalApiModule } from '@/shared/libs/http/external-api.module';
import { StorageModule } from '@/shared/libs/storage/storage.module';
import { ContentModule } from '../content/content.module';
import { MediaAssetModule } from '../media-asset/media-asset.module';
import { GenerateVideoUseCase } from './application/use-cases/generate-video.usecase';
import { GetVideoGenerationStatusUseCase } from './application/use-cases/get-video-generation-status.usecase';
import { CompleteVideoGenerationUseCase } from './application/use-cases/complete-video-generation.usecase';
import { VideoProvider } from './domain/providers/video.provider';
import { VideoReviewProvider } from './domain/providers/video-review.provider';
import { VideoGenerationRepository } from './domain/repositories/video-generation.repository';
import { VideoGenerationController } from './infra/controllers/video-generation.controller';
import { PrismaVideoGenerationRepository } from './infra/prisma/video-generation.prisma-repository';
import { CreatomateProvider } from './infra/providers/creatomate.provider';
import { MultimodalVideoReviewProvider } from './infra/providers/multimodal-video-review.provider';

@Module({
  imports: [ContentModule, MediaAssetModule, StorageModule, ExternalApiModule, AiModule],
  controllers: [VideoGenerationController],
  exports: [GenerateVideoUseCase, CompleteVideoGenerationUseCase],
  providers: [
    GenerateVideoUseCase, GetVideoGenerationStatusUseCase, CompleteVideoGenerationUseCase,
    { provide: VideoGenerationRepository, useClass: PrismaVideoGenerationRepository },
    { provide: VideoProvider, useClass: CreatomateProvider },
    { provide: VideoReviewProvider, useClass: MultimodalVideoReviewProvider },
  ],
})
export class VideoGenerationModule {}
