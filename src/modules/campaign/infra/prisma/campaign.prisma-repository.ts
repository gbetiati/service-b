import { Injectable } from '@nestjs/common';
import type { Campaign as Row } from '@prisma/client';
import { assertCatalogUnused } from '@/prisma/catalog-usage';
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

  delete (id: string) {
    const companyId = this.requestContext.companyId;
    return this.prismaService.serializable(async tx => {
      const where = { companyId_id: { companyId, id } };

      if (!await tx.campaign.findUnique({ where, select: { id: true } })) return false;

      await assertCatalogUnused(tx, companyId, { campaignIds: [id] }, 'A campanha é usada');
      await tx.campaign.delete({ where });
      return true;
    });
  }

  private toDomain (row: Row) {
    return new Campaign(row.id, row.companyId, row.name, row.createdAt, row.updatedAt, row.brandId, row.objective);
  }
}
