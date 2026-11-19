import { Injectable } from '@nestjs/common';
import { requireRecord } from '@/shared/core/errors/app.error';
import { ProductRepository } from '@/modules/product/domain/repositories/product.repository';
import { MediaAssetRepository } from '../../domain/repositories/media-asset.repository';

@Injectable()
export class ListMediaAssetsUseCase {
  constructor(
    private readonly mediaAssetRepository: MediaAssetRepository,
    private readonly productRepository: ProductRepository,
  ) {}

  async execute (productId: string) {
    requireRecord(await this.productRepository.findById(productId), 'Produto');
    return this.mediaAssetRepository.findByProduct(productId);
  }
}
