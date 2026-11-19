import { Module } from '@nestjs/common';
import { StorageModule } from '@/shared/libs/storage/storage.module';
import { VideoGenerationModule } from '../video-generation/video-generation.module';
import { SocialAccountModule } from '../social-account/social-account.module';
import { PublicationExecutionReader } from './application/ports/publication-execution-reader';
import { PublicationSchedulingTransaction } from './application/ports/publication-scheduling-transaction';
import { HandleScriptCompletedUseCase } from './application/use-cases/handle-script-completed.usecase';
import { HandleVideoRenderCompletedUseCase } from './application/use-cases/handle-video-render-completed.usecase';
import { GetPublicationUseCase } from './application/use-cases/get-publication.usecase';
import { PublicationOrchestrator } from './application/use-cases/publication.orchestrator';
import { PublishScheduledContentUseCase } from './application/use-cases/publish-scheduled-content.usecase';
import { SchedulePublicationUseCase } from './application/use-cases/schedule-publication.usecase';
import { PublicationRepository } from './domain/repositories/publication.repository';
import { CreatomateWebhookController } from './infra/controllers/creatomate-webhook.controller';
import { OpenAiWebhookController } from './infra/controllers/open-ai-webhook.controller';
import { PublicationController } from './infra/controllers/publication.controller';
import { PrismaPublicationExecutionReader } from './infra/prisma/prisma-publication-execution-reader';
import { PrismaPublicationSchedulingTransaction } from './infra/prisma/prisma-publication-scheduling-transaction';
import { PrismaPublicationRepository } from './infra/prisma/publication.prisma-repository';
import { PublicationScheduler } from './infra/schedule/publication.scheduler';

@Module({
  imports: [SocialAccountModule, StorageModule, VideoGenerationModule],
  controllers: [PublicationController, OpenAiWebhookController, CreatomateWebhookController],
  providers: [
    GetPublicationUseCase, SchedulePublicationUseCase, PublishScheduledContentUseCase, PublicationOrchestrator, HandleScriptCompletedUseCase, HandleVideoRenderCompletedUseCase,
    PublicationScheduler, PrismaPublicationRepository,
    { provide: PublicationRepository, useExisting: PrismaPublicationRepository },
    { provide: PublicationExecutionReader, useClass: PrismaPublicationExecutionReader },
    { provide: PublicationSchedulingTransaction, useClass: PrismaPublicationSchedulingTransaction },
  ],
})
export class PublicationModule {}
