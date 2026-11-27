import { Injectable } from '@nestjs/common';
import { AppError } from '@/shared/core/errors/app.error';
import { MediaAssetKind } from '../../domain/entities/media-asset-kind';
import { MediaAssetRepository } from '../../domain/repositories/media-asset.repository';

// Corrige o tipo de uma foto já enviada (só o produto ou com pessoas). Vale para os próximos vídeos gerados.
@Injectable()
export class UpdateMediaAssetKindUseCase {
  constructor(
    private readonly mediaAssetRepository: MediaAssetRepository,
  ) {}

  async execute (id: string, kind: MediaAssetKind) {
    const asset = await this.mediaAssetRepository.updateKind(id, kind);

    if (!asset) throw new AppError('missing', 'Mídia não encontrada.');

    return asset;
  }
}
