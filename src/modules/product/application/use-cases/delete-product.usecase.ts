import { Injectable, Logger } from '@nestjs/common';
import { requireRecord } from '@/shared/core/errors/app.error';
import { removeStoredFiles } from '@/shared/libs/storage/remove-stored-files';
import { StorageProvider } from '@/shared/libs/storage/storage.provider';
import { ProductRepository } from '../../domain/repositories/product.repository';

// Exclui o produto junto com as imagens dele. Recusa se algum conteúdo ou agendamento depende dele.
@Injectable()
export class DeleteProductUseCase {
  private readonly logger = new Logger(DeleteProductUseCase.name);

  constructor(
    private readonly productRepository: ProductRepository,
    private readonly storageProvider: StorageProvider,
  ) {}

  async execute (id: string) {
    const keys = requireRecord(await this.productRepository.delete(id), 'Produto');
    await removeStoredFiles(this.storageProvider, keys, this.logger);
  }
}
