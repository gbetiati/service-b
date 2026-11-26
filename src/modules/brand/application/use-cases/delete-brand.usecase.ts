import { Injectable, Logger } from '@nestjs/common';
import { AppError } from '@/shared/core/errors/app.error';
import { removeStoredFiles } from '@/shared/libs/storage/remove-stored-files';
import { StorageProvider } from '@/shared/libs/storage/storage.provider';
import { BrandRepository } from '../../domain/repositories/brand.repository';

// Exclui a marca junto com campanhas, regras, produtos e imagens. Recusa se algum conteúdo ou agendamento depende deles.
@Injectable()
export class DeleteBrandUseCase {
  private readonly logger = new Logger(DeleteBrandUseCase.name);

  constructor(
    private readonly brandRepository: BrandRepository,
    private readonly storageProvider: StorageProvider,
  ) {}

  async execute (id: string) {
    const keys = await this.brandRepository.delete(id);

    if (!keys) throw new AppError('missing', 'Marca não encontrada.');

    await removeStoredFiles(this.storageProvider, keys, this.logger);
  }
}
