import { Injectable } from '@nestjs/common';
import type { ImageTemplateSetting as Row } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { RequestContext } from '@/shared/core/request-context/request-context';
import { MediaAssetKind } from '@/modules/media-asset/domain/entities/media-asset-kind';
import type { ProductAdTemplate } from '@/modules/video-generation/infra/remotion/product-ad.compositions';
import type { ImageTemplateSetting } from '../../domain/entities/image-template-setting';
import { ImageTemplateSettingRepository } from '../../domain/repositories/image-template-setting.repository';

@Injectable()
export class PrismaImageTemplateSettingRepository implements ImageTemplateSettingRepository {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly requestContext: RequestContext,
  ) {}

  async findAll () {
    const rows = await this.prismaService.imageTemplateSetting.findMany({ where: { companyId: this.requestContext.companyId } });
    return rows.map(row => this.toDomain(row));
  }

  async save (template: ProductAdTemplate, slotKinds: MediaAssetKind[]) {
    const companyId = this.requestContext.companyId;
    const row = await this.prismaService.imageTemplateSetting.upsert({
      where: { companyId_template: { companyId, template } }, create: { companyId, template, slotKinds }, update: { slotKinds },
    });
    return this.toDomain(row);
  }

  async remove (template: ProductAdTemplate) {
    const { count } = await this.prismaService.imageTemplateSetting.deleteMany({ where: { companyId: this.requestContext.companyId, template } });
    return count > 0;
  }

  private toDomain (row: Row): ImageTemplateSetting {
    return { template: row.template as ProductAdTemplate, slotKinds: row.slotKinds.map(kind => MediaAssetKind[kind]), updatedAt: row.updatedAt };
  }
}
