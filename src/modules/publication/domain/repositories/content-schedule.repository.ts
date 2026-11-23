import type { ContentPreparationCandidate, ContentPreparationInput } from '@/modules/content/domain/repositories/content-preparation.repository';
import type { PublicationSchedule } from '../entities/content-scheduled.entity';

export type SaveContentScheduleInput = {
  companyId: string; contentId: string; videoId?: string; socialAccountId: string;
  date: Date; caption?: string;
};

export abstract class ContentScheduleRepository {
  abstract save (input: SaveContentScheduleInput): Promise<PublicationSchedule>;

  abstract findById (id: string): Promise<PublicationSchedule | null>;

  abstract findEligibleContents (): Promise<ContentPreparationCandidate[]>;

  abstract failPreparation (input: ContentPreparationInput, revision: number, error: string): Promise<void>;

  abstract expireSchedules (): Promise<void>;
}
