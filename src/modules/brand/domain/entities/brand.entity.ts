import { randomUUID } from 'node:crypto';

export class Brand {
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
    return new Brand(randomUUID(), companyId, name, now, now);
  }
}
