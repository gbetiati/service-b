import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { Authenticated } from '@/modules/identity/infra/guards/authenticated.decorator';
import { CompleteOnboardingDto } from '../../application/dto/complete-onboarding.dto';
import { StartOnboardingDto } from '../../application/dto/start-onboarding.dto';
import { CompleteOnboardingUseCase } from '../../application/use-cases/complete-onboarding.usecase';
import { GetOnboardingUseCase } from '../../application/use-cases/get-onboarding.usecase';
import { StartOnboardingUseCase } from '../../application/use-cases/start-onboarding.usecase';
import { OnboardingSession } from '../../domain/entities/onboarding-session.entity';

@Controller('onboarding')
@Authenticated()
export class OnboardingController {
  constructor(
    private readonly startOnboarding: StartOnboardingUseCase,
    private readonly getOnboarding: GetOnboardingUseCase,
    private readonly completeOnboarding: CompleteOnboardingUseCase,
  ) {}

  // Inicia a análise do site e do Instagram; a tela acompanha por GET /onboarding/sessions/current.
  @Post('sessions')
  async start (@Body() dto: StartOnboardingDto) {
    return toResponse(await this.startOnboarding.execute(dto));
  }

  @Get('sessions/current')
  async current () {
    const session = await this.getOnboarding.execute();
    return { session: session && toResponse(session) };
  }

  // Conclui com os dados revisados (ou preenchidos à mão, sem sessão).
  @Post('complete')
  @HttpCode(200)
  complete (@Body() dto: CompleteOnboardingDto) {
    return this.completeOnboarding.execute(dto);
  }
}

function toResponse ({ id, websiteUrl, instagramHandle, status, stage, findings, error, createdAt, updatedAt }: OnboardingSession) {
  return { id, websiteUrl, instagramHandle, status, stage, findings, error, createdAt, updatedAt };
}
