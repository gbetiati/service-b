import { Injectable } from '@nestjs/common';
import type { ProductCategory as Row } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { RequestContext } from '@/shared/core/request-context/request-context';
import { ProductCategory } from '../../domain/entities/product-category.entity';
import { ProductCategoryRepository } from '../../domain/repositories/product-category.repository';

@Injectable()
export class PrismaProductCategoryRepository implements ProductCategoryRepository {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly requestContext: RequestContext,
  ) {}

  async create(entity: ProductCategory)
  {
    const row = await this.prismaService.productCategory.create({ data: { ...entity, companyId: this.requestContext.companyId } });
    return this.toDomain(row);
  }
  async findById(id: string)
  {
    const row = await this.prismaService.productCategory.findUnique({ where: { companyId_id: { id, companyId: this.requestContext.companyId } } });
    return row && this.toDomain(row);
  }
  async findAll()
  {
    const rows = await this.prismaService.productCategory.findMany({ where: { companyId: this.requestContext.companyId }, orderBy: { createdAt: 'desc' } });
    return rows.map(row => this.toDomain(row));
  }

  private toDomain(row: Row)
  {
    return new ProductCategory(row.id, row.companyId, row.name, row.createdAt, row.updatedAt);
  }
}
