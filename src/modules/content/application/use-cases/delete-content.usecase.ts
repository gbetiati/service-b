import { Injectable, Logger } from '@nestjs/common';
import { requireRecord } from '@/shared/core/errors/app.error';
import { removeStoredFiles } from '@/shared/libs/storage/remove-stored-files';
import { StorageProvider } from '@/shared/libs/storage/storage.provider';
import { ContentRepository } from '../../domain/repositories/content.repository';

// Exclui o conteúdo com vídeos, histórico e agendamentos (o que estava agendado deixa de ser publicado). Posts já
// publicados no Instagram continuam lá. Recusa enquanto uma publicação do conteúdo está sendo enviada.
@Injectable()
export class DeleteContentUseCase {
  private readonly logger = new Logger(DeleteContentUseCase.name);

  constructor(
    private readonly contentRepository: ContentRepository,
    private readonly storageProvider: StorageProvider,
  ) {}

  async execute (id: string) {
    const keys = requireRecord(await this.contentRepository.delete(id), 'Conteúdo');
    await removeStoredFiles(this.storageProvider, keys, this.logger);
  }
}
