import { randomUUID } from 'node:crypto';

export class CampaignRules {
  constructor(
    readonly id: string,
    readonly companyId: string,
    readonly name: string,
    readonly createdAt: Date,
    readonly updatedAt: Date,
    readonly campaingId: string,
    readonly guidelines: string,
  ) {}

  static create (companyId: string, name: string, campaingId: string, guidelines: string) {
    const now = new Date();
    return new CampaignRules(randomUUID(), companyId, name, now, now, campaingId, guidelines);
  }
}
