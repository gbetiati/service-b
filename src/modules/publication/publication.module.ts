import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { StorageModule } from '@/shared/libs/storage/storage.module';
import { SocialAccountModule } from '../social-account/social-account.module';
import { GetPublicationUseCase } from './application/use-cases/get-publication.usecase';
import { PublishScheduledContentUseCase } from './application/use-cases/publish-scheduled-content.usecase';
import { SchedulePublicationUseCase } from './application/use-cases/schedule-publication.usecase';
import { PublicationRepository } from './domain/repositories/publication.repository';
import { PublicationController } from './infra/controllers/publication.controller';
import { PrismaPublicationRepository } from './infra/prisma/publication.prisma-repository';
import { PublicationScheduleProcessor } from './infra/queue/publication-schedule.processor';
import { PUBLICATION_SCHEDULE } from './infra/queue/publication-schedule.queue';
import { PublicationScheduleReconciler } from './infra/queue/publication-schedule.reconciler';

@Module({
  imports: [BullModule.registerQueue({ name: PUBLICATION_SCHEDULE }), SocialAccountModule, StorageModule],
  controllers: [PublicationController],
  providers: [
    GetPublicationUseCase, SchedulePublicationUseCase, PublishScheduledContentUseCase,
    PublicationScheduleProcessor, PublicationScheduleReconciler,
    { provide: PublicationRepository, useClass: PrismaPublicationRepository },
  ],
})
export class PublicationModule {}
