import type { ContentPreparationState } from '../repositories/content-preparation.repository';

type PreparationStages = Pick<ContentPreparationState, 'scriptStatus' | 'videoStatus' | 'transcriptionStatus' | 'subtitleStatus'>;

export class ContentPreparationPolicy {
  static hasFailed ({ scriptStatus, videoStatus, transcriptionStatus, subtitleStatus }: PreparationStages) {
    return [scriptStatus, videoStatus, transcriptionStatus, subtitleStatus].includes('FAILED');
  }
}
