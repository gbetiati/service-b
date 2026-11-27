import { Module } from '@nestjs/common';
import { ExternalApiModule } from '@/shared/libs/http/external-api.module';
import { StorageModule } from '@/shared/libs/storage/storage.module';
import { CreateContentUseCase } from './application/use-cases/create-content.usecase';
import { DeleteContentUseCase } from './application/use-cases/delete-content.usecase';
import { GetContentDetailsUseCase } from './application/use-cases/get-content-details.usecase';
import { GetContentHistoryUseCase } from './application/use-cases/get-content-history.usecase';
import { ListContentUseCase } from './application/use-cases/list-content.usecase';
import { ReviewContentUseCase } from './application/use-cases/review-content.usecase';
import { UpdateContentUseCase } from './application/use-cases/update-content.usecase';
import { ScriptProvider } from './domain/providers/script.provider';
import { ContentPreparationRepository } from './domain/repositories/content-preparation.repository';
import { ContentRepository } from './domain/repositories/content.repository';
import { ContentController } from './infra/controllers/content.controller';
import { PrismaContentPreparationRepository } from './infra/prisma/prisma-content-preparation-repository';
import { PrismaContentRepository } from './infra/prisma/content.prisma-repository';
import { ClaudeScriptProvider } from './infra/providers/claude-script.provider';
import { MockScriptProvider } from './infra/providers/mock-script.provider';

// O roteiro é escrito pelo Claude. A aplicação não sobe sem a configuração dele.
// TESTE (mock): fora de uso enquanto o MockScriptProvider estiver ligado abaixo.
function claudeScriptProvider (claude: ClaudeScriptProvider): ScriptProvider {
  claude.assertConfigured();
  return claude;
}

@Module({
  imports: [ExternalApiModule, StorageModule],
  controllers: [ContentController],
  providers: [
    CreateContentUseCase, DeleteContentUseCase, GetContentDetailsUseCase, GetContentHistoryUseCase, ListContentUseCase, UpdateContentUseCase, ReviewContentUseCase,
    { provide: ContentPreparationRepository, useClass: PrismaContentPreparationRepository },
    PrismaContentRepository,
    { provide: ContentRepository, useExisting: PrismaContentRepository },
    ClaudeScriptProvider, MockScriptProvider,
    // TESTE (mock): roteiro simulado enquanto não há ANTHROPIC_API_KEY.
    // { provide: ScriptProvider, inject: [ClaudeScriptProvider], useFactory: claudeScriptProvider },
    { provide: ScriptProvider, useExisting: MockScriptProvider },
  ],
  exports: [CreateContentUseCase, UpdateContentUseCase, ContentRepository, PrismaContentRepository, ContentPreparationRepository, ScriptProvider],
})
export class ContentModule {}
