import { Injectable } from '@nestjs/common';
import { requireRecord } from '@/shared/core/errors/app.error';
import { CampaignRepository } from '../../domain/repositories/campaign.repository';

@Injectable()
export class GetCampaignUseCase {
  constructor(
    private readonly campaignRepository: CampaignRepository,
  ) {}

  async execute (id: string) {
    return requireRecord(await this.campaignRepository.findById(id), 'Campaign');
  }
}
