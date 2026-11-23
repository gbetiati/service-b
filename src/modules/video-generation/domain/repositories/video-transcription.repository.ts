export abstract class VideoTranscriptionRepository {
  abstract claim (input: { companyId: string; contentId: string; revision: number }):
    Promise<{ submissionId: string; storageKey: string } | null>;

  abstract finish (submissionId: string, result: { text: string; srt: string } | null): Promise<void>;
}
