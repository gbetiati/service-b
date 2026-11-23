export type SubtitleJob = {
  companyId: string;
  contentId: string;
  revision: number;
  leaseUntil: Date;
  videoId: string;
  storageKey: string;
  srt: string;
};

export abstract class VideoSubtitlesRepository {
  abstract claim (input: Pick<SubtitleJob, 'companyId' | 'contentId' | 'revision'>): Promise<SubtitleJob | null>;

  abstract finish (job: SubtitleJob, outputKey: string | null): Promise<void>;
}
