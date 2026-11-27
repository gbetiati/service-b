import { Controller, Get } from '@nestjs/common';
import { GetCompanyUseCase } from '../../application/use-cases/get-company.usecase';
import { Authenticated } from '../guards/authenticated.decorator';

@Controller('companies')
@Authenticated()
export class CompanyController {
  constructor(
    private readonly getCompanyUseCase: GetCompanyUseCase,
  ) {}

  // Inclui onboardingRequired: o frontend manda para o onboarding a empresa que ainda não o concluiu.
  @Get('me')
  async get () {
    const company = await this.getCompanyUseCase.execute();
    const { profile, ...rest } = company;
    return { ...rest, ...profile, onboardingRequired: company.onboardingRequired };
  }
}
