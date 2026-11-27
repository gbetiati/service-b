import type { ContentPreparationCandidate, ContentPreparationInput } from '@/modules/content/domain/repositories/content-preparation.repository';
import type { Content, ContentAudio } from '@/modules/content/domain/entities/content.entity';
import type { ContentMediaType } from '@/modules/content/domain/entities/content-media-type';
import type { PublicationSchedule } from '../entities/content-scheduled.entity';

export type SaveContentScheduleInput = {
  companyId: string; contentId: string; videoId?: string; socialAccountId: string;
  date: Date; caption?: string;
};

// `audio` são as opções de áudio do conteúdo que será criado na janela de preparação. `contentMediaType` escolhe se ele
// usa as fotos ou os vídeos do produto (omitido: fotos).
export type ScheduledContentDraft = { campaingId: string; campaingRulesId: string; productId: string; audio?: Partial<ContentAudio>; contentMediaType?: ContentMediaType };

export type CreatePublicationScheduleInput = SaveContentScheduleInput |
  (Omit<SaveContentScheduleInput, 'contentId' | 'videoId'> & { contentDraft: ScheduledContentDraft });

export type ClaimedContentDraft = { id: string; companyId: string; contentDraft: ScheduledContentDraft; leaseUntil: Date };

export abstract class ContentScheduleRepository {
  abstract save (input: SaveContentScheduleInput): Promise<PublicationSchedule>;

  abstract findById (id: string): Promise<PublicationSchedule | null>;

  abstract findEligibleDrafts (): Promise<{ id: string }[]>;

  abstract claimDraft (id: string): Promise<ClaimedContentDraft | null>;

  abstract attachCreatedContent (job: ClaimedContentDraft, content: Content): Promise<boolean>;

  abstract failDraft (job: ClaimedContentDraft, error: string): Promise<void>;

  abstract findEligibleContents (): Promise<ContentPreparationCandidate[]>;

  abstract failPreparation (input: ContentPreparationInput, revision: number, error: string): Promise<void>;

  abstract expireSchedules (): Promise<void>;
}
