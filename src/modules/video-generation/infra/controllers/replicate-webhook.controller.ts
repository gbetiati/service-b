import { BadRequestException, Controller, HttpCode, Logger, Post, Query, Req, UnauthorizedException } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { Webhook } from 'standardwebhooks';
import { requiredEnv } from '@/shared/core/config';
import { CompleteVideoGenerationUseCase } from '../../application/use-cases/complete-video-generation.usecase';
import { ReplicateH3LiteProvider } from '../providers/replicate-h3-lite.provider';

type Prediction = { id?: unknown; status?: unknown; output?: unknown };

@Controller('webhooks/replicate')
export class ReplicateWebhookController {
  private readonly logger = new Logger(ReplicateWebhookController.name);

  constructor(
    private readonly completeVideoGenerationUseCase: CompleteVideoGenerationUseCase,
    private readonly replicateProvider: ReplicateH3LiteProvider,
  ) {}

  @Post()
  @HttpCode(204)
  async receive(@Req() request: RawBodyRequest<Request>, @Query('submissionId') submissionId: unknown) {
    const secret = requiredEnv('REPLICATE_WEBHOOK_SECRET');
    let prediction: Prediction | null;
    try {
      if (!request.rawBody) throw new Error('Corpo original ausente.');
      prediction = new Webhook(secret).verify(request.rawBody, {
        'webhook-id': request.header('webhook-id') ?? '',
        'webhook-timestamp': request.header('webhook-timestamp') ?? '',
        'webhook-signature': request.header('webhook-signature') ?? '',
      }) as Prediction | null;
    } catch {
      this.logger.warn('Webhook da Replicate rejeitado por assinatura inválida.');
      throw new UnauthorizedException('Assinatura inválida do webhook da Replicate.');
    }

    if (typeof submissionId !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(submissionId)
      || typeof prediction?.id !== 'string' || !prediction.id) {
      throw new BadRequestException('Identificação ausente ou inválida no webhook da Replicate.');
    }

    const { status, output } = prediction;
    const providerId = this.replicateProvider.providerId(prediction.id);

    if (status === 'failed' || status === 'canceled') {
      await this.completeVideoGenerationUseCase.execute({ submissionId, providerId, outcome: { state: 'failed' } });
    } else if (status === 'succeeded') {
      if (typeof output !== 'string' || !output) {
        throw new BadRequestException('Webhook da Replicate sem URL de vídeo.');
      }
      await this.completeVideoGenerationUseCase.execute(
        { submissionId, providerId, outcome: { state: 'ready', url: output } },
        url => this.replicateProvider.download(url),
      );
    }
  }
}
