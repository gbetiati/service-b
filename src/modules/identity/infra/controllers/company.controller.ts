import { Controller, Get, UseGuards } from '@nestjs/common';
import { GetCompanyUseCase } from '../../application/use-cases/get-company.usecase';
import { JwtAuthGuard } from '../jwt/jwt-auth.guard';
import { TenantGuard } from '../guards/tenant.guard';

@Controller('companies')
@UseGuards(JwtAuthGuard, TenantGuard)
export class CompanyController {
  constructor(
    private readonly getCompanyUseCase: GetCompanyUseCase,
  ) {}

  @Get('me')
  get () {
    return this.getCompanyUseCase.execute();
  }
}
