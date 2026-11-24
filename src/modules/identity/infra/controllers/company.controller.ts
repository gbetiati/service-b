import { Controller, Get } from '@nestjs/common';
import { GetCompanyUseCase } from '../../application/use-cases/get-company.usecase';
import { Authenticated } from '../guards/authenticated.decorator';

@Controller('companies')
@Authenticated()
export class CompanyController {
  constructor(
    private readonly getCompanyUseCase: GetCompanyUseCase,
  ) {}

  @Get('me')
  get () {
    return this.getCompanyUseCase.execute();
  }
}
