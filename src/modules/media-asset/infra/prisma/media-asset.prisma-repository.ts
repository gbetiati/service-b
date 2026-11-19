import { Injectable } from '@nestjs/common';
import type { MediaAsset as Row } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { RequestContext } from '@/shared/core/request-context/request-context';
import { MediaAsset } from '../../domain/entities/media-asset.entity';
import { MediaAssetRepository } from '../../domain/repositories/media-asset.repository';

@Injectable()
export class PrismaMediaAssetRepository implements MediaAssetRepository {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly requestContext: RequestContext,
  ) {}

  async create(asset: MediaAsset)
  {
    return this.toDomain(await this.prismaService.mediaAsset.create({ data: { ...asset, companyId: this.requestContext.companyId } }));
  }
  async findById(id: string)
  {
    const row = await this.prismaService.mediaAsset.findUnique({ where: { companyId_id: { id, companyId: this.requestContext.companyId } } });
    return row && this.toDomain(row);
  }
  async findByProduct(productId: string)
  {
    const rows = await this.prismaService.mediaAsset.findMany({ where: { productId, companyId: this.requestContext.companyId }, orderBy: { createdAt: 'desc' } });
    return rows.map(row => this.toDomain(row));
  }
  async findByIds(ids: string[])
  {
    const rows = await this.prismaService.mediaAsset.findMany({ where: { id: { in: ids }, companyId: this.requestContext.companyId } });
    return rows.map(row => this.toDomain(row));
  }

  private toDomain(row: Row)
  {
    return new MediaAsset(row.id, row.companyId, row.productId, row.storageKey, row.contentType, row.bytes, row.createdAt, row.updatedAt);
  }
}
