import { Injectable } from '@nestjs/common';
import type { Brand as Row } from '@prisma/client';
import { assertCatalogUnused } from '@/prisma/catalog-usage';
import { PrismaService } from '@/prisma/prisma.service';
import { RequestContext } from '@/shared/core/request-context/request-context';
import { Brand } from '../../domain/entities/brand.entity';
import { BrandRepository } from '../../domain/repositories/brand.repository';

@Injectable()
export class PrismaBrandRepository implements BrandRepository {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly requestContext: RequestContext,
  ) {}

  async create (entity: Brand) {
    const row = await this.prismaService.brand.create({ data: { ...entity, companyId: this.requestContext.companyId } });
    return this.toDomain(row);
  }

  async findById (id: string) {
    const row = await this.prismaService.brand.findUnique({ where: { companyId_id: { id, companyId: this.requestContext.companyId } } });
    return row && this.toDomain(row);
  }

  async findAll () {
    const rows = await this.prismaService.brand.findMany({ where: { companyId: this.requestContext.companyId }, orderBy: { createdAt: 'desc' } });
    return rows.map(row => this.toDomain(row));
  }

  updateLogo (id: string, logoStorageKey: string | null) {
    const where = { companyId_id: { companyId: this.requestContext.companyId, id } };
    return this.prismaService.$transaction(async tx => {
      const brand = await tx.brand.findUnique({ where, select: { logoStorageKey: true } });

      if (!brand) return null;

      await tx.brand.update({ where, data: { logoStorageKey } });
      return { previous: brand.logoStorageKey };
    });
  }

  delete (id: string) {
    const companyId = this.requestContext.companyId;
    return this.prismaService.serializable(async tx => {
      const brand = await tx.brand.findUnique({
        where: { companyId_id: { companyId, id } },
        select: { logoStorageKey: true, campaigns: { select: { id: true } }, products: { select: { id: true, media: { select: { storageKey: true } } } } },
      });

      if (!brand) return null;

      const productIds = brand.products.map(product => product.id);
      await assertCatalogUnused(tx, companyId, { campaignIds: brand.campaigns.map(campaign => campaign.id), productIds }, 'A marca é usada');
      await tx.brand.delete({ where: { companyId_id: { companyId, id } } });
      const media = brand.products.flatMap(product => product.media.map(item => item.storageKey));
      return brand.logoStorageKey ? [...media, brand.logoStorageKey] : media;
    });
  }

  private toDomain (row: Row) {
    return new Brand(
      row.id, row.companyId, row.name, row.createdAt, row.updatedAt,
      row.primaryColor, row.secondaryColor, row.tertiaryColor, row.quaternaryColor, row.voiceTone, row.targetAudience, row.copyGuidelines, row.logoStorageKey,
    );
  }
}
