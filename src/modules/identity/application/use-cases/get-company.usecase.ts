import { Injectable } from '@nestjs/common';
import { requireRecord } from '@/shared/core/errors/app.error';
import { CompanyRepository } from '../../domain/repositories/company.repository';

@Injectable()
export class GetCompanyUseCase {
  constructor(
    private readonly companyRepository: CompanyRepository,
  ) {}
  async execute()
  { return requireRecord(await this.companyRepository.findCurrent(), 'Empresa'); }
}
