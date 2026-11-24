import { Injectable } from '@nestjs/common';
import { AppError } from '@/shared/core/errors/app.error';
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
  ) {}

  async execute (dto: CreateContentDto) {
    return this.contentRepository.create(await this.prepare(dto));
  }

  // Valida campanha, regra, produtos e imagens sem gerar roteiro nem persistir.
  async validateReferences (dto: CreateContentDto) {
    await this.build(dto);
  }

  // Monta o conteúdo com roteiro, gerando-o pela IA quando não foi informado. Não persiste.
  async prepare (dto: CreateContentDto) {
    const { content, brief } = await this.build(dto);
    const script = dto.aiScript ?? await this.scriptProvider.generate(brief);

    if (!script.trim()) throw new AppError('invalid', 'O roteiro do conteúdo precisa ter texto.');

    content.fields.aiScript = script;
    return content;
  }

  private async build (dto: CreateContentDto) {
    const content = Content.create(this.requestContext.companyId, {
      campaingId: dto.campaingId, campaingRulesId: dto.campaingRulesId, productId: dto.productId,
      productIds: dto.productIds ?? [], aiScript: dto.aiScript ?? '', editorial: dto.editorial ?? {},
      assets: ContentAsset.fromMediaAssetIds(dto.mediaAssetIds ?? []),
    });
    const brief = content.buildScriptBrief(await this.contentRepository.findReferences(content));
    return { content, brief };
  }
}
