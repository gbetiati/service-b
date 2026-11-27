import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RunOnboardingResearchUseCase } from '../../application/use-cases/run-onboarding-research.usecase';

const SESSIONS_PER_TICK = 2;

@Injectable()
export class OnboardingScheduler {
  private readonly logger = new Logger(OnboardingScheduler.name);

  constructor(
    private readonly research: RunOnboardingResearchUseCase,
  ) {}

  // Processa as varreduras pendentes. Uma varredura interrompida (servidor reiniciado) volta quando o lease vence.
  @Cron('*/5 * * * * *', { name: 'Onboarding-research', waitForCompletion: true })
  async run () {
    try {
      await Promise.all(Array.from({ length: SESSIONS_PER_TICK }, () => this.research.runNext()));
    } catch (error) {
      this.logger.error('Falha ao processar varreduras do onboarding.', error instanceof Error ? error.stack : undefined);
    }
  }
}
