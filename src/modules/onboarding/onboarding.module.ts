import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BrandModule } from '@/modules/brand/brand.module';
import { CompleteOnboardingUseCase } from './application/use-cases/complete-onboarding.usecase';
import { GetOnboardingUseCase } from './application/use-cases/get-onboarding.usecase';
import { RunOnboardingResearchUseCase } from './application/use-cases/run-onboarding-research.usecase';
import { StartOnboardingUseCase } from './application/use-cases/start-onboarding.usecase';
import { BusinessProfileExtractor } from './domain/providers/business-profile-extractor';
import { InstagramProfileProvider } from './domain/providers/instagram-profile.provider';
import { RemoteImageDownloader } from './domain/providers/remote-image-downloader';
import { WebsiteScanner } from './domain/providers/website-scanner';
import { OnboardingSessionRepository } from './domain/repositories/onboarding-session.repository';
import { OnboardingController } from './infra/controllers/onboarding.controller';
import { PrismaOnboardingSessionRepository } from './infra/prisma/onboarding-session.prisma-repository';
import { ClaudeBusinessProfileExtractor } from './infra/providers/claude-business-profile.extractor';
import { HtmlWebsiteScanner } from './infra/providers/html-website-scanner';
import { MetaBusinessDiscoveryProvider } from './infra/providers/meta-business-discovery.provider';
import { OpenAiBusinessProfileExtractor } from './infra/providers/openai-business-profile.extractor';
import { SafeImageDownloader } from './infra/providers/safe-image-downloader';
import { OnboardingScheduler } from './infra/schedule/onboarding.scheduler';

// Onboarding da empresa depois do primeiro login: análise do site e do Instagram, revisão e criação da marca principal.
@Module({
  imports: [BrandModule],
  controllers: [OnboardingController],
  providers: [
    StartOnboardingUseCase, GetOnboardingUseCase, CompleteOnboardingUseCase, RunOnboardingResearchUseCase, OnboardingScheduler,
    { provide: OnboardingSessionRepository, useClass: PrismaOnboardingSessionRepository },
    { provide: WebsiteScanner, useClass: HtmlWebsiteScanner },
    { provide: InstagramProfileProvider, useClass: MetaBusinessDiscoveryProvider },
    OpenAiBusinessProfileExtractor, ClaudeBusinessProfileExtractor,
    // IA da análise do negócio: ONBOARDING_AI_PROVIDER=openai (padrão) ou claude.
    {
      provide: BusinessProfileExtractor, inject: [ConfigService, OpenAiBusinessProfileExtractor, ClaudeBusinessProfileExtractor],
      useFactory: (config: ConfigService, openai: OpenAiBusinessProfileExtractor, claude: ClaudeBusinessProfileExtractor) =>
        config.get<string>('ONBOARDING_AI_PROVIDER')?.trim().toLowerCase() === 'claude' ? claude : openai,
    },
    { provide: RemoteImageDownloader, useClass: SafeImageDownloader },
  ],
})
export class OnboardingModule {}
