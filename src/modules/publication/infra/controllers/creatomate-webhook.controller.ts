import { timingSafeEqual } from 'node:crypto';
import { Body, Controller, HttpCode, Post, Query } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { requiredEnv } from '@/shared/core/config';
import { AppError } from '@/shared/core/errors/app.error';
import { CompleteVideoGenerationUseCase } from '@/modules/video-generation/application/use-cases/complete-video-generation.usecase';

@Controller('webhooks/creatomate')
export class CreatomateWebhookController {
  constructor(
    private readonly completeVideoGenerationUseCase: CompleteVideoGenerationUseCase,
  ) {}

  @Post()
  @HttpCode(204)
  async receive (@Query('token') token: unknown, @Body() body: Record<string, unknown>) {
    
    const expected = Buffer.from(requiredEnv('CREATOMATE_WEBHOOK_SECRET'));
    const received = Buffer.from(typeof token === 'string' ? token : '');
    
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
      throw new AppError('unauthorized', 'Webhook não autorizado.');
    }

    const { id, metadata, status, url } = body ?? {};
    
    if (typeof id !== 'string' || !isUUID(id) || typeof metadata !== 'string' || !isUUID(metadata)) {
      throw new AppError('invalid', 'Webhook sem identificação do render.');
    }
    
    if (status !== 'succeeded' && status !== 'failed') return;
    
    const render = { submissionId: metadata, providerId: id };
    
    if (status === 'failed') {
      return this.completeVideoGenerationUseCase.execute({ ...render, outcome: { state: 'failed' } });
    }

    if (typeof url !== 'string' || !url) throw new AppError('invalid', 'Webhook sem a URL do vídeo.');

    await this.completeVideoGenerationUseCase.execute({ ...render, outcome: { state: 'ready', url } });
  }
}
