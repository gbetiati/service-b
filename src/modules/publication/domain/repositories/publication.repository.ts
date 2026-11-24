import type { ContentPreparationInput } from '@/modules/content/domain/repositories/content-preparation.repository';
import { Publication, PublicationWork } from '../entities/publication.entity';
import type { CreatePublicationScheduleInput } from './content-schedule.repository';

export type PreparedPublicationContent = ContentPreparationInput & { revision: number; videoId: string };

export abstract class PublicationRepository {
  abstract createScheduled (input: CreatePublicationScheduleInput): Promise<Publication>;

  abstract createFromPreparedContent (input: PreparedPublicationContent): Promise<void>;

  abstract findById (id: string): Promise<Publication | null>;

  abstract findEligibleIds (): Promise<{ id: string }[]>;

  abstract reserveForProcessing (id: string): Promise<PublicationWork | null>;

  abstract releaseProcessing (job: PublicationWork, containerId?: string): Promise<void>;

  abstract attachApprovedVideo (job: PublicationWork, videoId: string): Promise<void>;

  abstract markPublished (job: PublicationWork, externalId?: string): Promise<void>;

  abstract markFailed (job: PublicationWork, reason: string): Promise<void>;
}
