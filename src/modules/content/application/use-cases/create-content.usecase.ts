import { Injectable } from '@nestjs/common';
import { RequestContext } from '@/shared/core/request-context/request-context';
import { ContentAsset } from '../../domain/entities/content-asset.entity';
import { Content } from '../../domain/entities/content.entity';
import { ScriptProvider } from '../../domain/providers/script.provider';
import { ContentRepository } from '../../domain/repositories/content.repository';
import { CreateContentDto } from '../dto/create-content.dto';

@Injectable()
export class CreateContentUseCase {
  constructor(
    private readonly contentRepository: ContentRepository,
    private readonly requestContext: RequestContext,
    private readonly scriptProvider: ScriptProvider,
  ) { }

  async execute(dto: CreateContentDto) {
    const content = Content.create(
      this.requestContext.companyId, {
      campaingId: dto.campaingId,
      campaingRulesId: dto.campaingRulesId,
      productId: dto.productId,
      productIds: dto.productIds ?? [],
      aiScript: dto.aiScript ?? '',
      editorial: dto.editorial ?? {},
      assets: dto.mediaAssetIds?.map((id, position) => new ContentAsset(position, id)) ?? [],
    });

    const brief = content.buildScriptBrief(await this.contentRepository.findReferences(content));

    content.fields.aiScript = dto.aiScript ?? await this.scriptProvider.generate(brief);

    return this.contentRepository.create(content);
  }
}
