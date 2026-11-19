import { BullModule } from '@nestjs/bullmq';
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
import { ProductCategoryModule } from './modules/product-category/product-category.module';
import { PublicationModule } from './modules/publication/publication.module';
import { SocialAccountModule } from './modules/social-account/social-account.module';
import { VideoGenerationModule } from './modules/video-generation/video-generation.module';
import { PrismaModule } from './prisma/prisma.module';
import { RequestContextModule } from './shared/core/request-context/request-context.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), PrismaModule, RequestContextModule, ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      useFactory: () => {
        const url = new URL(process.env.REDIS_URL || 'redis://localhost:6379');
        if (!['redis:', 'rediss:'].includes(url.protocol)) throw new Error('REDIS_URL precisa usar redis:// ou rediss://.');
        return { connection: {
          host: url.hostname, port: Number(url.port || 6379), db: Number(url.pathname.slice(1) || 0),
          username: decodeURIComponent(url.username) || undefined, password: decodeURIComponent(url.password) || undefined,
          tls: url.protocol === 'rediss:' ? {} : undefined,
        } };
      },
    }),
    IdentityModule, BrandModule, CampaignModule, CampaignRulesModule, ProductModule, ProductCategoryModule, MediaAssetModule,
    ContentModule, VideoGenerationModule, SocialAccountModule, PublicationModule,
  ],
})
export class AppModule {}
