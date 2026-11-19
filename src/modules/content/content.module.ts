import { Module } from '@nestjs/common';
import { AiModule } from '@/shared/libs/ai/ai.module';
import { BrandModule } from '../brand/brand.module';
import { CampaignModule } from '../campaign/campaign.module';
import { CampaignRulesModule } from '../campaign-rules/campaign-rules.module';
import { MediaAssetModule } from '../media-asset/media-asset.module';
import { ProductModule } from '../product/product.module';
import { ContentCatalogService } from './application/services/content-catalog.service';
import { CreateContentUseCase } from './application/use-cases/create-content.usecase';
import { GetContentDetailsUseCase } from './application/use-cases/get-content-details.usecase';
import { GetContentHistoryUseCase } from './application/use-cases/get-content-history.usecase';
import { ListContentUseCase } from './application/use-cases/list-content.usecase';
import { UpdateContentUseCase } from './application/use-cases/update-content.usecase';
import { ScriptProvider } from './domain/providers/script.provider';
import { ContentRepository } from './domain/repositories/content.repository';
import { ContentController } from './infra/controllers/content.controller';
import { PrismaContentRepository } from './infra/prisma/content.prisma-repository';
import { OpenAiScriptProvider } from './infra/providers/open-ai-script.provider';

@Module({
  imports: [AiModule, BrandModule, CampaignModule, CampaignRulesModule, MediaAssetModule, ProductModule],
  controllers: [ContentController],
  providers: [
    ContentCatalogService, CreateContentUseCase, GetContentDetailsUseCase, GetContentHistoryUseCase, ListContentUseCase, UpdateContentUseCase,
    { provide: ContentRepository, useClass: PrismaContentRepository },
    { provide: ScriptProvider, useClass: OpenAiScriptProvider },
  ],
  exports: [ContentRepository, ContentCatalogService, ScriptProvider],
})
export class ContentModule {}
