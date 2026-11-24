import { Module } from '@nestjs/common';
import { StorageModule } from '@/shared/libs/storage/storage.module';
import { ProductModule } from '../product/product.module';
import { GetMediaAssetUrlUseCase } from './application/use-cases/get-media-asset-url.usecase';
import { ListMediaAssetsUseCase } from './application/use-cases/list-media-assets.usecase';
import { UploadMediaAssetUseCase } from './application/use-cases/upload-media-asset.usecase';
import { ImageProcessorProvider } from './domain/providers/image-processor.provider';
import { VideoFileInspector } from './domain/providers/video-file-inspector.provider';
import { MediaAssetRepository } from './domain/repositories/media-asset.repository';
import { MediaAssetController } from './infra/controllers/media-asset.controller';
import { PrismaMediaAssetRepository } from './infra/prisma/media-asset.prisma-repository';
import { FfprobeVideoFileInspector } from './infra/providers/ffprobe-video-file-inspector.provider';
import { SharpImageProcessorProvider } from './infra/providers/sharp-image-processor.provider';

@Module({
  imports: [ProductModule, StorageModule],
  controllers: [MediaAssetController],
  providers: [
    GetMediaAssetUrlUseCase, ListMediaAssetsUseCase, UploadMediaAssetUseCase,
    { provide: MediaAssetRepository, useClass: PrismaMediaAssetRepository },
    { provide: ImageProcessorProvider, useClass: SharpImageProcessorProvider },
    { provide: VideoFileInspector, useClass: FfprobeVideoFileInspector },
  ],
  exports: [MediaAssetRepository],
})
export class MediaAssetModule {}
