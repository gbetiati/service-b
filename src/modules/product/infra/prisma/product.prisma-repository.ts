import { Injectable } from '@nestjs/common';
import type { Product as Row } from '@prisma/client';
import { assertCatalogUnused } from '@/prisma/catalog-usage';
import { PrismaService } from '@/prisma/prisma.service';
import { RequestContext } from '@/shared/core/request-context/request-context';
import { Product } from '../../domain/entities/product.entity';
import { ProductRepository } from '../../domain/repositories/product.repository';

@Injectable()
export class PrismaProductRepository implements ProductRepository {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly requestContext: RequestContext,
  ) {}

  async create (entity: Product) {
    const row = await this.prismaService.product.create({ data: { ...entity, companyId: this.requestContext.companyId } });
    return this.toDomain(row);
  }

  async findById (id: string) {
    const row = await this.prismaService.product.findUnique({ where: { companyId_id: { id, companyId: this.requestContext.companyId } } });
    return row && this.toDomain(row);
  }

  async findAll (offset?: number, limit?: number) {
    const rows = await this.prismaService.product.findMany({
      where: { companyId: this.requestContext.companyId }, skip: offset, take: limit, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map(row => this.toDomain(row));
  }

  delete (id: string) {
    const companyId = this.requestContext.companyId;
    return this.prismaService.serializable(async tx => {
      const where = { companyId_id: { companyId, id } };
      const product = await tx.product.findUnique({ where, select: { media: { select: { storageKey: true } } } });

      if (!product) return null;

      await assertCatalogUnused(tx, companyId, { productIds: [id] }, 'O produto é usado');
      await tx.product.delete({ where });
      return product.media.map(media => media.storageKey);
    });
  }

  private toDomain (row: Row) {
    return new Product(row.id, row.companyId, row.name, row.createdAt, row.updatedAt, row.brandId, row.description, row.price?.toFixed(2) ?? null, row.oldPrice?.toFixed(2) ?? null);
  }
}
