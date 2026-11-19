import { Injectable } from '@nestjs/common';
import type { Brand as Row } from '@prisma/client';
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

  private toDomain (row: Row) {
    return new Brand(row.id, row.companyId, row.name, row.createdAt, row.updatedAt);
  }
}
