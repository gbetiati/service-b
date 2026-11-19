import { Injectable } from '@nestjs/common';
import { CampaignRulesRepository } from '../../domain/repositories/campaign-rules.repository';

@Injectable()
export class ListCampaignRulesUseCase {
  constructor(
    private readonly campaignRulesRepository: CampaignRulesRepository,
  ) {}

  execute () {
    return this.campaignRulesRepository.findAll();
  }
}
