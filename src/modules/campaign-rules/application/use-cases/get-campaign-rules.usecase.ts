import { Injectable } from '@nestjs/common';
import { requireRecord } from '@/shared/core/errors/app.error';
import { CampaignRulesRepository } from '../../domain/repositories/campaign-rules.repository';

@Injectable()
export class GetCampaignRulesUseCase {
  constructor(
    private readonly campaignRulesRepository: CampaignRulesRepository,
  ) {}
  async execute(id: string)
  { return requireRecord(await this.campaignRulesRepository.findById(id), 'CampaignRules'); }
}
