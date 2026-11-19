import { Injectable } from '@nestjs/common';
import { AppError, requireRecord } from '@/shared/core/errors/app.error';
import { ContentAsset } from '../../domain/entities/content-asset.entity';
import { ContentRepository } from '../../domain/repositories/content.repository';
import { UpdateContentDto } from '../dto/update-content.dto';

@Injectable()
export class UpdateContentUseCase {
  constructor(
    private readonly contentRepository: ContentRepository,
  ) {}

  async execute (id: string, dto: UpdateContentDto) {
    const current = requireRecord(await this.contentRepository.findById(id), 'Conteúdo');

    if (dto.revision !== current.revision) throw new AppError('conflict', 'A revisão informada está desatualizada.');

    const fields = current.fields;
    const content = current.revise({
      campaingId: dto.campaingId ?? fields.campaingId, campaingRulesId: dto.campaingRulesId ?? fields.campaingRulesId,
      productId: dto.productId ?? fields.productId, productIds: dto.productIds ?? fields.productIds,
      aiScript: dto.aiScript ?? fields.aiScript, editorial: dto.editorial ?? fields.editorial,
      assets: dto.mediaAssetIds?.map((id, position) => new ContentAsset(position, id)) ?? fields.assets,
    });
    content.validateReferences(await this.contentRepository.findReferences(content));
    return this.contentRepository.update(content);
  }
}
