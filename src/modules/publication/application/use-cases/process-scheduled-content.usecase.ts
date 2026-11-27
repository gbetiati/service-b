import { Injectable, Logger } from '@nestjs/common';
import { CONTENT_MAX_MEDIA_ASSETS } from '@/modules/content/domain/entities/content.entity';
import { ContentMediaType, mediaMatchesType } from '@/modules/content/domain/entities/content-media-type';
import { CreateContentUseCase } from '@/modules/content/application/use-cases/create-content.usecase';
import { MediaAssetRepository } from '@/modules/media-asset/domain/repositories/media-asset.repository';
import { AppError } from '@/shared/core/errors/app.error';
import { RequestContext } from '@/shared/core/request-context/request-context';
import { ContentScheduleRepository } from '../../domain/repositories/content-schedule.repository';

@Injectable()
export class ProcessScheduledContentUseCase {
  private readonly logger = new Logger(ProcessScheduledContentUseCase.name);

  constructor(
    private readonly schedules: ContentScheduleRepository,
    private readonly createContent: CreateContentUseCase,
    private readonly mediaAssets: MediaAssetRepository,
    private readonly requestContext: RequestContext,
  ) {}

  // Cria o conteúdo de um agendamento feito por rascunho, usando as fotos ou os vídeos do produto (conforme o tipo do
  // rascunho), e o associa ao agendamento.
  async execute (scheduleId: string) {
    const job = await this.schedules.claimDraft(scheduleId);
    if (!job) return null;

    return this.requestContext.runForCompany(job.companyId, async () => {
      try {
        const contentMediaType = job.contentDraft.contentMediaType ?? ContentMediaType.IMAGE;
        const media = await this.mediaAssets.findByProduct(job.contentDraft.productId);
        const mediaAssetIds = media.filter(item => mediaMatchesType(item.contentType, contentMediaType)).slice(0, CONTENT_MAX_MEDIA_ASSETS).map(item => item.id);

        if (!mediaAssetIds.length) {
          throw new AppError('invalid', `Associe ao menos ${contentMediaType === ContentMediaType.VIDEO ? 'um vídeo real' : 'uma foto real'} ao produto para criar o conteúdo.`);
        }

        const content = await this.createContent.prepare({ ...job.contentDraft, contentMediaType, mediaAssetIds });
        const attached = await this.schedules.attachCreatedContent(job, content);

        return attached ? { companyId: job.companyId, contentId: content.id } : null;
      } catch (error) {
        const message = error instanceof AppError ? error.message : 'Não foi possível criar o conteúdo agendado.';
        this.logger.warn(`Agendamento ${job.id}: ${message}`);

        await this.schedules.failDraft(job, message);
        return null;
      }
    });
  }
}
