import { Module } from '@nestjs/common';
import { StorageModule } from '@/shared/libs/storage/storage.module';
import { VideoGenerationModule } from '../video-generation/video-generation.module';
import { SocialAccountModule } from '../social-account/social-account.module';
import { MediaAssetModule } from '../media-asset/media-asset.module';
import { ContentModule } from '../content/content.module';
import { ContentScheduleRepository } from './domain/repositories/content-schedule.repository';
import { PublicationSchedulingTransaction } from './application/ports/publication-scheduling-transaction';
import { CreateScheduledPublicationUseCase } from './application/use-cases/create-scheduled-publication.usecase';
import { GetPublicationScheduleUseCase } from './application/use-cases/get-publication-schedule.usecase';
import { GetPublicationUseCase } from './application/use-cases/get-publication.usecase';
import { ListPublicationSchedulesUseCase } from './application/use-cases/list-publication-schedules.usecase';
import { ProcessScheduledContentUseCase } from './application/use-cases/process-scheduled-content.usecase';
import { PublicationOrchestrator } from './application/use-cases/publication.orchestrator';
import { PublishScheduledContentUseCase } from './application/use-cases/publish-scheduled-content.usecase';
import { SchedulePublicationUseCase } from './application/use-cases/schedule-publication.usecase';
import { PublicationRepository } from './domain/repositories/publication.repository';
import { PublicationController } from './infra/controllers/publication.controller';
import { PrismaContentScheduleRepository } from './infra/prisma/prisma-content-schedule-repository';
import { PrismaPublicationSchedulingTransaction } from './infra/prisma/prisma-publication-scheduling-transaction';
import { PrismaPublicationRepository } from './infra/prisma/publication.prisma-repository';
import { PublicationScheduler } from './infra/schedule/publication.scheduler';

@Module({
  imports: [ContentModule, MediaAssetModule, SocialAccountModule, StorageModule, VideoGenerationModule],
  controllers: [PublicationController],
  providers: [
    GetPublicationUseCase, GetPublicationScheduleUseCase, SchedulePublicationUseCase, CreateScheduledPublicationUseCase, PublishScheduledContentUseCase, PublicationOrchestrator,
    ListPublicationSchedulesUseCase, ProcessScheduledContentUseCase, PublicationScheduler, PrismaPublicationRepository, PrismaContentScheduleRepository,
    { provide: PublicationRepository, useExisting: PrismaPublicationRepository },
    { provide: ContentScheduleRepository, useExisting: PrismaContentScheduleRepository },
    { provide: PublicationSchedulingTransaction, useClass: PrismaPublicationSchedulingTransaction },
  ],
})
export class PublicationModule {}
