import { Injectable } from '@nestjs/common';
import { requireRecord } from '@/shared/core/errors/app.error';
import { RequestContext } from '@/shared/core/request-context/request-context';
import { StorageProvider } from '@/shared/libs/storage/storage.provider';
import { ProductRepository } from '@/modules/product/domain/repositories/product.repository';
import { MediaAsset } from '../../domain/entities/media-asset.entity';
import { ImageProcessorProvider } from '../../domain/providers/image-processor.provider';
import { VideoFileInspector } from '../../domain/providers/video-file-inspector.provider';
import { MediaAssetRepository } from '../../domain/repositories/media-asset.repository';

@Injectable()
export class UploadMediaAssetUseCase {
  constructor(
    private readonly mediaAssetRepository: MediaAssetRepository,
    private readonly productRepository: ProductRepository,
    private readonly requestContext: RequestContext,
    private readonly imageProcessorProvider: ImageProcessorProvider,
    private readonly storageProvider: StorageProvider,
    private readonly videoFileInspector: VideoFileInspector,
  ) {}

  async execute (productId: string, file: Buffer, mimeType?: string) {
    requireRecord(await this.productRepository.findById(productId), 'Produto');
    const video = mimeType?.startsWith('video/') || file.toString('ascii', 4, 8) === 'ftyp';
    if (video) await this.videoFileInspector.validateMp4(file);
    const body = video ? file : await this.imageProcessorProvider.normalize(file);
    const asset = MediaAsset.create(this.requestContext.companyId, productId, body.length, video ? 'video/mp4' : 'image/jpeg');
    await this.storageProvider.put(asset.storageKey, body, asset.contentType);
    try {
      return await this.mediaAssetRepository.create(asset);
    } catch (error) {
      await this.storageProvider.remove(asset.storageKey).catch(() => undefined);
      throw error;
    }
  }
}
