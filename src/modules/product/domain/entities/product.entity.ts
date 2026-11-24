import { randomUUID } from 'node:crypto';

export class Product {
  constructor(
    readonly id: string,
    readonly companyId: string,
    readonly name: string,
    readonly createdAt: Date,
    readonly updatedAt: Date,
    readonly brandId: string,
    readonly description: string | null,
    readonly price: string | null = null,
    readonly oldPrice: string | null = null,
  ) {}

  static create (companyId: string, name: string, brandId: string, description: string | null, price: string | null = null, oldPrice: string | null = null) {
    const now = new Date();
    return new Product(randomUUID(), companyId, name, now, now, brandId, description, price, oldPrice);
  }
}
