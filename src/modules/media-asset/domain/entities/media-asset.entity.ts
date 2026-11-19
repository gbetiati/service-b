import { randomUUID } from 'node:crypto';

export class MediaAsset {
  constructor(
    readonly id: string,
    readonly companyId: string,
    readonly productId: string,
    readonly storageKey: string,
    readonly contentType: string,
    readonly bytes: number,
    readonly createdAt: Date,
    readonly updatedAt: Date,
  ) {}

  static create (companyId: string, productId: string, bytes: number) {
    const id = randomUUID();
    const now = new Date();
    return new MediaAsset(id, companyId, productId, `${companyId}/products/${productId}/${id}.jpg`, 'image/jpeg', bytes, now, now);
  }
}
