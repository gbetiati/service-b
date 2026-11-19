import { randomUUID } from 'node:crypto';

export class Campaign {
  constructor(
    readonly id: string,
    readonly companyId: string,
    readonly name: string,
    readonly createdAt: Date,
    readonly updatedAt: Date,
    readonly brandId: string,
    readonly objective: string | null,
  ) {}

  static create(companyId: string, name: string, brandId: string, objective: string | null)
  {
    const now = new Date();
    return new Campaign(randomUUID(), companyId, name, now, now, brandId, objective);
  }
}
