export type SubtitleJob = {
  companyId: string;
  contentId: string;
  revision: number;
  leaseUntil: Date;
  videoId: string;
  storageKey: string;
  srt: string;
};

export type SubtitleTarget = Pick<SubtitleJob, 'companyId' | 'contentId' | 'revision'>;

export abstract class VideoSubtitlesRepository {
  abstract claim (input: SubtitleTarget): Promise<SubtitleJob | null>;

  abstract finish (job: SubtitleJob, outputKey: string | null): Promise<void>;
}
