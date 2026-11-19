import { Publication, PublicationWork } from '../entities/publication.entity';

export type SavePublicationInput = {
  companyId: string; contentId: string; videoId?: string; socialAccountId: string;
  date: Date; caption?: string;
};

export type PublicationPhase = 'preparation' | 'publication';

export abstract class PublicationRepository {
  abstract save (input: SavePublicationInput): Promise<Publication>;

  abstract findById (id: string): Promise<Publication | null>;

  abstract findEligibleIds (phase: PublicationPhase): Promise<{ id: string }[]>;

  abstract reserveForProcessing (id: string, phase: PublicationPhase): Promise<PublicationWork | null>;

  abstract releaseProcessing (job: PublicationWork, containerId?: string): Promise<void>;

  abstract attachApprovedVideo (job: PublicationWork, videoId: string): Promise<void>;

  abstract markPublished (job: PublicationWork, externalId?: string): Promise<void>;

  abstract markFailed (job: PublicationWork, reason: string): Promise<void>;
}
