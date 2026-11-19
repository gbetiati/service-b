import { CampaignRules } from '../entities/campaign-rules.entity';

export abstract class CampaignRulesRepository {
  abstract create (entity: CampaignRules): Promise<CampaignRules>;

  abstract findById (id: string): Promise<CampaignRules | null>;

  abstract findAll (): Promise<CampaignRules[]>;
}
