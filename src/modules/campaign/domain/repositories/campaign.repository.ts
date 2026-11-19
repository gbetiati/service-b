import { Campaign } from '../entities/campaign.entity';

export abstract class CampaignRepository {
  abstract create(entity: Campaign): Promise<Campaign>;
  abstract findById(id: string): Promise<Campaign | null>;
  abstract findAll(): Promise<Campaign[]>;
}
