import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { BrandModule } from './modules/brand/brand.module';
import { CampaignModule } from './modules/campaign/campaign.module';
import { CampaignRulesModule } from './modules/campaign-rules/campaign-rules.module';
import { ContentModule } from './modules/content/content.module';
import { IdentityModule } from './modules/identity/identity.module';
import { MediaAssetModule } from './modules/media-asset/media-asset.module';
import { ProductModule } from './modules/product/product.module';
import { PublicationModule } from './modules/publication/publication.module';
import { SocialAccountModule } from './modules/social-account/social-account.module';
import { VideoGenerationModule } from './modules/video-generation/video-generation.module';
import { PrismaModule } from './prisma/prisma.module';
import { RequestContextModule } from './shared/core/request-context/request-context.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), PrismaModule, RequestContextModule, ScheduleModule.forRoot(),
    IdentityModule, BrandModule, CampaignModule, CampaignRulesModule, ProductModule, MediaAssetModule,
    ContentModule, VideoGenerationModule, SocialAccountModule, PublicationModule,
  ],
})
export class AppModule {}
