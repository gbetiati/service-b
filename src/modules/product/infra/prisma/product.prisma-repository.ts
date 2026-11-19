import { Injectable } from '@nestjs/common';
import type { Product as Row } from '@prisma/client';
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

  async create(entity: Product)
  {
    const row = await this.prismaService.product.create({ data: { ...entity, companyId: this.requestContext.companyId } });
    return this.toDomain(row);
  }
  async findById(id: string)
  {
    const row = await this.prismaService.product.findUnique({ where: { companyId_id: { id, companyId: this.requestContext.companyId } } });
    return row && this.toDomain(row);
  }
  async findAll()
  {
    const rows = await this.prismaService.product.findMany({ where: { companyId: this.requestContext.companyId }, orderBy: { createdAt: 'desc' } });
    return rows.map(row => this.toDomain(row));
  }

  private toDomain(row: Row)
  {
    return new Product(row.id, row.companyId, row.name, row.createdAt, row.updatedAt, row.brandId, row.categoryId, row.description);
  }
}
