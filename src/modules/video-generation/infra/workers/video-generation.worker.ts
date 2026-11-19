import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RenderVideoUseCase } from '../../application/use-cases/render-video.usecase';

@Injectable()
export class VideoGenerationWorker {
  private readonly logger = new Logger(VideoGenerationWorker.name);
  constructor(
    private readonly renderVideoUseCase: RenderVideoUseCase,
  ) {}

  @Cron('*/5 * * * * *', { waitForCompletion: true })
  async run()
  {
    try {
      await this.renderVideoUseCase.execute();
    } catch {
      this.logger.error('Falha no processamento de renders.');
    }
  }
}
