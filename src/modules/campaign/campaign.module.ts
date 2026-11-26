import { Module } from '@nestjs/common';
import { BrandModule } from '../brand/brand.module';
import { CreateCampaignUseCase } from './application/use-cases/create-campaign.usecase';
import { DeleteCampaignUseCase } from './application/use-cases/delete-campaign.usecase';
import { GetCampaignUseCase } from './application/use-cases/get-campaign.usecase';
import { ListCampaignUseCase } from './application/use-cases/list-campaign.usecase';
import { CampaignRepository } from './domain/repositories/campaign.repository';
import { CampaignController } from './infra/controllers/campaign.controller';
import { PrismaCampaignRepository } from './infra/prisma/campaign.prisma-repository';

@Module({
  imports: [BrandModule],
  controllers: [CampaignController],
  providers: [
    CreateCampaignUseCase, DeleteCampaignUseCase, GetCampaignUseCase, ListCampaignUseCase,
    { provide: CampaignRepository, useClass: PrismaCampaignRepository },
  ],
  exports: [CampaignRepository],
})
export class CampaignModule {}
