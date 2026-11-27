import { Injectable, Logger } from '@nestjs/common';
import { AppError } from '@/shared/core/errors/app.error';
import { removeStoredFiles } from '@/shared/libs/storage/remove-stored-files';
import { StorageProvider } from '@/shared/libs/storage/storage.provider';
import { BrandRepository } from '../../domain/repositories/brand.repository';

// Remove o logo da marca e o arquivo no storage. Repetir não muda nada.
@Injectable()
export class RemoveBrandLogoUseCase {
  private readonly logger = new Logger(RemoveBrandLogoUseCase.name);

  constructor(
    private readonly brandRepository: BrandRepository,
    private readonly storageProvider: StorageProvider,
  ) {}

  async execute (brandId: string) {
    const result = await this.brandRepository.updateLogo(brandId, null);

    if (!result) throw new AppError('missing', 'Marca não encontrada.');

    if (result.previous) await removeStoredFiles(this.storageProvider, [result.previous], this.logger);
  }
}
