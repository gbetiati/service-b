import { Injectable } from '@nestjs/common';
import { CampaignRepository } from '../../domain/repositories/campaign.repository';

@Injectable()
export class ListCampaignUseCase {
  constructor(
    private readonly campaignRepository: CampaignRepository,
  ) {}

  execute () {
    return this.campaignRepository.findAll();
  }
}
