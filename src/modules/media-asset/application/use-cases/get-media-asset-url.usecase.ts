import { Injectable } from '@nestjs/common';
import { requireRecord } from '@/shared/core/errors/app.error';
import { StorageProvider } from '@/shared/libs/storage/storage.provider';
import { MediaAssetRepository } from '../../domain/repositories/media-asset.repository';

@Injectable()
export class GetMediaAssetUrlUseCase {
  constructor(
    private readonly mediaAssetRepository: MediaAssetRepository,
    private readonly storageProvider: StorageProvider,
  ) {}

  async execute (id: string) {
    const asset = requireRecord(await this.mediaAssetRepository.findById(id), 'Imagem');
    return { url: await this.storageProvider.url(asset.storageKey) };
  }
}
