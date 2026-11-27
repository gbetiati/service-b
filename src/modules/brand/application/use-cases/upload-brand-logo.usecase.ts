import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { requireRecord } from '@/shared/core/errors/app.error';
import { RequestContext } from '@/shared/core/request-context/request-context';
import { removeStoredFiles } from '@/shared/libs/storage/remove-stored-files';
import { StorageProvider } from '@/shared/libs/storage/storage.provider';
import { LogoImageProcessor } from '../../domain/providers/logo-image-processor.provider';
import { BrandRepository } from '../../domain/repositories/brand.repository';

// Envia ou troca o logo da marca. O arquivo novo vai para o storage antes de a marca apontar para ele; o anterior só
// é apagado depois, para a marca nunca ficar apontando para um arquivo que não existe.
@Injectable()
export class UploadBrandLogoUseCase {
  private readonly logger = new Logger(UploadBrandLogoUseCase.name);

  constructor(
    private readonly brandRepository: BrandRepository,
    private readonly logoImageProcessor: LogoImageProcessor,
    private readonly storageProvider: StorageProvider,
    private readonly requestContext: RequestContext,
  ) {}

  async execute (brandId: string, file: Buffer) {
    requireRecord(await this.brandRepository.findById(brandId), 'Marca');
    const body = await this.logoImageProcessor.normalize(file);
    const key = `${this.requestContext.companyId}/brands/${brandId}/logo-${randomUUID()}.png`;
    await this.storageProvider.put(key, body, 'image/png');

    let previous: string | null;
    try {
      previous = requireRecord(await this.brandRepository.updateLogo(brandId, key), 'Marca').previous;
    } catch (error) {
      // A marca não foi atualizada: o arquivo novo ficaria órfão no storage.
      await removeStoredFiles(this.storageProvider, [key], this.logger);
      throw error;
    }

    if (previous) await removeStoredFiles(this.storageProvider, [previous], this.logger);

    return requireRecord(await this.brandRepository.findById(brandId), 'Marca');
  }
}
