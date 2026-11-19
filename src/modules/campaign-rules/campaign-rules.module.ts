import { Module } from '@nestjs/common';
import { CampaignModule } from '../campaign/campaign.module';
import { CreateCampaignRulesUseCase } from './application/use-cases/create-campaign-rules.usecase';
import { GetCampaignRulesUseCase } from './application/use-cases/get-campaign-rules.usecase';
import { ListCampaignRulesUseCase } from './application/use-cases/list-campaign-rules.usecase';
import { CampaignRulesRepository } from './domain/repositories/campaign-rules.repository';
import { CampaignRulesController } from './infra/controllers/campaign-rules.controller';
import { PrismaCampaignRulesRepository } from './infra/prisma/campaign-rules.prisma-repository';

@Module({
  imports: [CampaignModule],
  controllers: [CampaignRulesController],
  providers: [
    CreateCampaignRulesUseCase, GetCampaignRulesUseCase, ListCampaignRulesUseCase,
    { provide: CampaignRulesRepository, useClass: PrismaCampaignRulesRepository },
  ],
  exports: [CampaignRulesRepository],
})
export class CampaignRulesModule {}
