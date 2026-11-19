import { Injectable } from '@nestjs/common';
import { RequestContext } from '@/shared/core/request-context/request-context';
import { requireRecord } from '@/shared/core/errors/app.error';
import { CampaignRepository } from '@/modules/campaign/domain/repositories/campaign.repository';
import { CampaignRules } from '../../domain/entities/campaign-rules.entity';
import { CampaignRulesRepository } from '../../domain/repositories/campaign-rules.repository';
import { CreateCampaignRulesDto } from '../dto/create-campaign-rules.dto';

@Injectable()
export class CreateCampaignRulesUseCase {
  constructor(
    private readonly campaignRulesRepository: CampaignRulesRepository,
    private readonly requestContext: RequestContext,
    private readonly campaignRepository: CampaignRepository,
  ) {}

  async execute (dto: CreateCampaignRulesDto) {
    requireRecord(await this.campaignRepository.findById(dto.campaingId), 'Campanha');
    const entity = CampaignRules.create(this.requestContext.companyId, dto.name, dto.campaingId, dto.guidelines);
    return this.campaignRulesRepository.create(entity);
  }
}
