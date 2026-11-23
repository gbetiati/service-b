import type { ContentStatus } from '../entities/content-status';
import type { PreparationStatus } from '../entities/content.entity';

export type ContentPreparationInput = { companyId: string; contentId: string };

export type ContentPreparationCandidate = ContentPreparationInput & { updatedAt: Date };

export type ContentPreparationState = {
  status: ContentStatus;
  revision: number;
  scriptStatus: PreparationStatus;
  videoStatus: PreparationStatus;
  transcriptionStatus: PreparationStatus;
  subtitleStatus: PreparationStatus;
  video: { id: string; revision: number; reviewStatus: ContentStatus; storageKey: string } | null;
};

export abstract class ContentPreparationRepository {
  abstract request (input: ContentPreparationInput): Promise<void>;

  abstract findEligibleContents (limit: number): Promise<ContentPreparationCandidate[]>;

  abstract read (input: ContentPreparationInput, videoId?: string | null): Promise<ContentPreparationState>;

  abstract complete (input: ContentPreparationInput, revision: number): Promise<void>;
}
