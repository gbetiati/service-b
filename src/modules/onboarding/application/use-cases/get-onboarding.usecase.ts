import { Injectable } from '@nestjs/common';
import { RequestContext } from '@/shared/core/request-context/request-context';
import { OnboardingSessionRepository } from '../../domain/repositories/onboarding-session.repository';

// Sessão mais recente da empresa (ou null): a tela retoma de onde parou, inclusive depois de recarregar.
@Injectable()
export class GetOnboardingUseCase {
  constructor(
    private readonly sessions: OnboardingSessionRepository,
    private readonly requestContext: RequestContext,
  ) {}

  execute () {
    return this.sessions.findLatest(this.requestContext.companyId);
  }
}
