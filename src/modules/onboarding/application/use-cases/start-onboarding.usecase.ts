import { Injectable } from '@nestjs/common';
import { RequestContext } from '@/shared/core/request-context/request-context';
import { OnboardingSession } from '../../domain/entities/onboarding-session.entity';
import { OnboardingSessionRepository } from '../../domain/repositories/onboarding-session.repository';
import { StartOnboardingDto } from '../dto/start-onboarding.dto';

// Inicia a varredura do site e do Instagram. Ela roda em segundo plano (cron); a tela acompanha pela sessão.
@Injectable()
export class StartOnboardingUseCase {
  constructor(
    private readonly sessions: OnboardingSessionRepository,
    private readonly requestContext: RequestContext,
  ) {}

  execute (dto: StartOnboardingDto) {
    const websiteUrl = OnboardingSession.normalizeWebsite(dto.websiteUrl);
    const instagramHandle = OnboardingSession.normalizeHandle(dto.instagramHandle);
    OnboardingSession.validateInput(websiteUrl, instagramHandle);
    const { companyId, userId } = this.requestContext;
    return this.sessions.create({ companyId, userId, websiteUrl, instagramHandle });
  }
}
