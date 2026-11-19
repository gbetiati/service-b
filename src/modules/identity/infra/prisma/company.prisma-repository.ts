import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { RequestContext } from '@/shared/core/request-context/request-context';
import { Company } from '../../domain/entities/company.entity';
import { CompanyRepository } from '../../domain/repositories/company.repository';

@Injectable()
export class PrismaCompanyRepository implements CompanyRepository {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly requestContext: RequestContext,
  ) {}

  async findCurrent () {
    const row = await this.prismaService.company.findUnique({ where: { id: this.requestContext.companyId } });
    return row && new Company(row.id, row.name, row.createdAt, row.updatedAt);
  }
}
