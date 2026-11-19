import { randomUUID } from 'node:crypto';
import { AppError } from '@/shared/core/errors/app.error';
import { ContentAsset } from './content-asset.entity';
import { ContentStatus } from './content-status';

export type Editorial = { brief?: string; caption?: string; tags?: string[] };
export type ContentFields = {
  campaingId: string; campaingRulesId: string; productId: string; productIds: string[];
  aiScript: string; editorial: Editorial; assets: ContentAsset[];
};

export class Content {
  constructor(
    readonly id: string,
    readonly companyId: string,
    readonly fields: ContentFields,
    readonly revision: number,
    readonly status: ContentStatus,
    readonly createdAt: Date,
    readonly updatedAt: Date,
  ) {}

  static create (companyId: string, fields: ContentFields) {
    const now = new Date();
    return new Content(randomUUID(), companyId, fields, 1, ContentStatus.WAITING, now, now);
  }

  revise (fields: ContentFields) {
    return new Content(this.id, this.companyId, fields, this.revision + 1, ContentStatus.WAITING, this.createdAt, new Date());
  }

  get allProductIds () {
    if (this.fields.productIds.includes(this.fields.productId)) {
      throw new AppError('invalid', 'Use productIds somente para produtos adicionais.');
    }

    return [this.fields.productId, ...this.fields.productIds];
  }
}
