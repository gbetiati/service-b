import { Module } from '@nestjs/common';
import { AiModule } from '@/shared/libs/ai/ai.module';
import { CreateContentUseCase } from './application/use-cases/create-content.usecase';
import { GetContentDetailsUseCase } from './application/use-cases/get-content-details.usecase';
import { GetContentHistoryUseCase } from './application/use-cases/get-content-history.usecase';
import { ListContentUseCase } from './application/use-cases/list-content.usecase';
import { UpdateContentUseCase } from './application/use-cases/update-content.usecase';
import { ScriptProvider } from './domain/providers/script.provider';
import { ContentPreparationRepository } from './domain/repositories/content-preparation.repository';
import { PrismaContentPreparationRepository } from './infra/prisma/prisma-content-preparation-repository';
import { ContentRepository } from './domain/repositories/content.repository';
import { ContentController } from './infra/controllers/content.controller';
import { PrismaContentRepository } from './infra/prisma/content.prisma-repository';
import { OpenAiScriptProvider } from './infra/providers/open-ai-script.provider';

@Module({
  imports: [AiModule],
  controllers: [ContentController],
  providers: [
    CreateContentUseCase, GetContentDetailsUseCase, GetContentHistoryUseCase, ListContentUseCase, UpdateContentUseCase,
    { provide: ContentPreparationRepository, useClass: PrismaContentPreparationRepository },
    { provide: ContentRepository, useClass: PrismaContentRepository },
    { provide: ScriptProvider, useClass: OpenAiScriptProvider },
  ],
  exports: [UpdateContentUseCase, ContentRepository, ContentPreparationRepository, ScriptProvider],
})
export class ContentModule {}
