import { Injectable } from '@nestjs/common';
import type { CampaignRules as Row } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { RequestContext } from '@/shared/core/request-context/request-context';
import { CampaignRules } from '../../domain/entities/campaign-rules.entity';
import { CampaignRulesRepository } from '../../domain/repositories/campaign-rules.repository';

@Injectable()
export class PrismaCampaignRulesRepository implements CampaignRulesRepository {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly requestContext: RequestContext,
  ) {}

  async create (entity: CampaignRules) {
    const row = await this.prismaService.campaignRules.create({ data: { ...entity, companyId: this.requestContext.companyId } });
    return this.toDomain(row);
  }

  async findById (id: string) {
    const row = await this.prismaService.campaignRules.findUnique({ where: { companyId_id: { id, companyId: this.requestContext.companyId } } });
    return row && this.toDomain(row);
  }

  async findAll () {
    const rows = await this.prismaService.campaignRules.findMany({ where: { companyId: this.requestContext.companyId }, orderBy: { createdAt: 'desc' } });
    return rows.map(row => this.toDomain(row));
  }

  private toDomain (row: Row) {
    return new CampaignRules(row.id, row.companyId, row.name, row.createdAt, row.updatedAt, row.campaingId, row.guidelines);
  }
}
