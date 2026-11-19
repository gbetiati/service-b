import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { AppError } from '@/shared/core/errors/app.error';
import { RequestContext } from '@/shared/core/request-context/request-context';
import { ContentMapper } from '../../application/mappers/content.mapper';
import { Content, Editorial } from '../../domain/entities/content.entity';
import { ContentAsset } from '../../domain/entities/content-asset.entity';
import { ContentStatus } from '../../domain/entities/content-status';
import { ContentRepository } from '../../domain/repositories/content.repository';

const include = {
  assets: { orderBy: { position: 'asc' } }, products: { orderBy: { productId: 'asc' } },
} satisfies Prisma.ContentInclude;
type Row = Prisma.ContentGetPayload<{ include: typeof include }>;

@Injectable()
export class PrismaContentRepository implements ContentRepository {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly requestContext: RequestContext,
  ) {}

  create(content: Content)
  {
    const { id } = content;
    const companyId = this.requestContext.companyId;
    return this.prismaService.$transaction(async tx => {
      await tx.content.create({ data: { id, companyId, ...this.fields(content), ...this.relations(content) } });
      return this.saveSnapshot(tx, id, companyId);
    });
  }

  update(content: Content)
  {
    const { id, revision } = content;
    const companyId = this.requestContext.companyId;
    return this.prismaService.serializable(async tx => {
      const updated = await tx.content.updateMany({
        where: { companyId, id, revision: revision - 1 }, data: { ...this.fields(content), revision, status: 'WAITING' },
      });
      if (!updated.count) throw new AppError('conflict', 'A revisão informada está desatualizada.');
      const active = await tx.publication.count({
        where: { companyId, schedule: { contentId: id }, status: { in: ['SCHEDULED', 'PUBLISHING'] } },
      });
      if (active) throw new AppError('conflict', 'O conteúdo tem uma publicação em andamento.');
      const relations = { companyId, contentId: id };
      await tx.contentAsset.deleteMany({ where: relations });
      await tx.contentProduct.deleteMany({ where: relations });
      await tx.content.update({ where: { companyId_id: { companyId, id } }, data: this.relations(content) });
      // New revisions must not inherit an embedding calculated for the old script.
      await tx.$executeRaw`UPDATE contents SET embedding = NULL WHERE id = ${id} AND "companyId" = ${companyId}`;
      return this.saveSnapshot(tx, id, companyId);
    });
  }

  async findById(id: string)
  {
    const row = await this.prismaService.content.findUnique({ where: { companyId_id: { companyId: this.requestContext.companyId, id } }, include });
    return row && this.toDomain(row);
  }
  async findAll(skip: number, take: number)
  {
    const rows = await this.prismaService.content.findMany({
      where: { companyId: this.requestContext.companyId }, include, skip, take, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map(row => this.toDomain(row));
  }
  findHistory(contentId: string, skip: number, take: number)
  {
    return this.prismaService.contentHistory.findMany({
      where: { companyId: this.requestContext.companyId, contentId }, select: { revision: true, snapshot: true, createdAt: true },
      orderBy: { revision: 'desc' }, skip, take,
    });
  }

  private fields(content: Content)
  {
    const { aiScript, editorial, campaingId, campaingRulesId, productId } = content.fields;
    return { aiScript, editorial, campaingId, campaingRulesId, productId };
  }
  private relations(content: Content)
  {
    const { assets, productIds } = content.fields;
    return { assets: { create: assets }, products: { create: productIds.map(productId => ({ productId })) } };
  }
  private async saveSnapshot(tx: Prisma.TransactionClient, id: string, companyId: string)
  {
    const content = this.toDomain(await tx.content.findUniqueOrThrow({ where: { companyId_id: { id, companyId } }, include }));
    const { createdAt, updatedAt, ...snapshot } = ContentMapper.toResponse(content);
    await tx.contentHistory.create({ data: {
      companyId, contentId: id, revision: content.revision,
      snapshot: { ...snapshot, createdAt: createdAt.toISOString(), updatedAt: updatedAt.toISOString() },
    } });
    return content;
  }
  private toDomain(row: Row)
  {
    const { id, companyId, campaingId, campaingRulesId, productId, aiScript, editorial, status, revision, createdAt, updatedAt } = row;
    return new Content(id, companyId, {
      campaingId, campaingRulesId, productId, aiScript, editorial: editorial as Editorial,
      assets: row.assets.map(asset => new ContentAsset(asset.position, asset.mediaAssetId)),
      productIds: row.products.map(product => product.productId),
    }, revision, ContentStatus[status], createdAt, updatedAt);
  }
}
