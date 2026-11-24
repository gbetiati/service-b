import type { Transcript } from '../entities/transcript';

export type TranscriptionTarget = { companyId: string; contentId: string; revision: number };

export abstract class VideoTranscriptionRepository {
  abstract claim (input: TranscriptionTarget): Promise<{ submissionId: string; storageKey: string } | null>;

  abstract finish (submissionId: string, result: Transcript | null): Promise<void>;
}
