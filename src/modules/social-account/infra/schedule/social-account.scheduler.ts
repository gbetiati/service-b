import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RefreshExpiringInstagramTokensUseCase } from '../../application/use-cases/refresh-expiring-instagram-tokens.usecase';

@Injectable()
export class SocialAccountScheduler {
  private readonly logger = new Logger(SocialAccountScheduler.name);

  constructor(
    private readonly refreshExpiringInstagramTokensUseCase: RefreshExpiringInstagramTokensUseCase,
  ) {}

  // De hora em hora: com a janela de 10 dias antes do vencimento, uma falha do Instagram tem centenas de novas tentativas.
  @Cron(CronExpression.EVERY_HOUR, { name: 'Social-token-refresh', waitForCompletion: true })
  async refreshTokens () {
    try {
      const { refreshed, failed } = await this.refreshExpiringInstagramTokensUseCase.execute();

      if (refreshed || failed) this.logger.log(`Renovação de tokens do Instagram. renovados=${refreshed} falhas=${failed}`);
    } catch (error) {
      this.logger.error('Falha na renovação dos tokens do Instagram.', error instanceof Error ? error.stack : undefined);
    }
  }
}
