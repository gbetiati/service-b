import { Injectable } from '@nestjs/common';
import type { Campaign as Row } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { RequestContext } from '@/shared/core/request-context/request-context';
import { Campaign } from '../../domain/entities/campaign.entity';
import { CampaignRepository } from '../../domain/repositories/campaign.repository';

@Injectable()
export class PrismaCampaignRepository implements CampaignRepository {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly requestContext: RequestContext,
  ) {}

  async create (entity: Campaign) {
    const row = await this.prismaService.campaign.create({ data: { ...entity, companyId: this.requestContext.companyId } });
    return this.toDomain(row);
  }

  async findById (id: string) {
    const row = await this.prismaService.campaign.findUnique({ where: { companyId_id: { id, companyId: this.requestContext.companyId } } });
    return row && this.toDomain(row);
  }

  async findAll () {
    const rows = await this.prismaService.campaign.findMany({ where: { companyId: this.requestContext.companyId }, orderBy: { createdAt: 'desc' } });
    return rows.map(row => this.toDomain(row));
  }

  private toDomain (row: Row) {
    return new Campaign(row.id, row.companyId, row.name, row.createdAt, row.updatedAt, row.brandId, row.objective);
  }
}
