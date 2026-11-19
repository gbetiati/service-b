import { randomUUID } from 'node:crypto';

export class ProductCategory {
  constructor(
    readonly id: string,
    readonly companyId: string,
    readonly name: string,
    readonly createdAt: Date,
    readonly updatedAt: Date,
  ) {}

  static create(companyId: string, name: string)
  {
    const now = new Date();
    return new ProductCategory(randomUUID(), companyId, name, now, now);
  }
}
