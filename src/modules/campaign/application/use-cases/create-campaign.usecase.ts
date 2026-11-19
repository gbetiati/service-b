import { Injectable } from '@nestjs/common';
import { RequestContext } from '@/shared/core/request-context/request-context';
import { requireRecord } from '@/shared/core/errors/app.error';
import { BrandRepository } from '@/modules/brand/domain/repositories/brand.repository';
import { Campaign } from '../../domain/entities/campaign.entity';
import { CampaignRepository } from '../../domain/repositories/campaign.repository';
import { CreateCampaignDto } from '../dto/create-campaign.dto';

@Injectable()
export class CreateCampaignUseCase {
  constructor(
    private readonly campaignRepository: CampaignRepository,
    private readonly requestContext: RequestContext,
    private readonly brandRepository: BrandRepository,
  ) {}

  async execute (dto: CreateCampaignDto) {
    requireRecord(await this.brandRepository.findById(dto.brandId), 'Marca');
    const entity = Campaign.create(this.requestContext.companyId, dto.name, dto.brandId, dto.objective ?? null);
    return this.campaignRepository.create(entity);
  }
}
