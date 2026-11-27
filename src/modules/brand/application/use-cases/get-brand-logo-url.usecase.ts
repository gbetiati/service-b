import { Injectable } from '@nestjs/common';
import { AppError, requireRecord } from '@/shared/core/errors/app.error';
import { StorageProvider } from '@/shared/libs/storage/storage.provider';
import { BrandRepository } from '../../domain/repositories/brand.repository';

// URL assinada e temporária do logo, para o frontend exibir direto do storage.
@Injectable()
export class GetBrandLogoUrlUseCase {
  constructor(
    private readonly brandRepository: BrandRepository,
    private readonly storageProvider: StorageProvider,
  ) {}

  async execute (brandId: string) {
    const brand = requireRecord(await this.brandRepository.findById(brandId), 'Marca');

    if (!brand.logoStorageKey) throw new AppError('missing', 'A marca não tem logo.');

    return { url: await this.storageProvider.url(brand.logoStorageKey) };
  }
}
