import type { PublicationVideoState } from './publication.entity';
import { PUBLICATION_GRACE_MS, PUBLICATION_PREPARATION_MS } from './publication-timing';

export class PublicationPolicy {
  static canPublishWithCredential (
    accountActive: boolean,
    credential: { expiresAt: Date | null } | null,
    scheduleDate: Date,
    now: number,
  ) {
    if (!accountActive || !credential?.expiresAt) return false;

    return credential.expiresAt.getTime() > Math.max(now, scheduleDate.getTime());
  }

  static graceDeadline (scheduleDate: Date) {
    return new Date(scheduleDate.getTime() + PUBLICATION_GRACE_MS);
  }

  static isWithinGraceWindow (scheduleDate: Date, now: number) {
    return now < PublicationPolicy.graceDeadline(scheduleDate).getTime();
  }

  static calculateInitialAttemptAt (scheduleDate: Date, hasVideo: boolean) {
    return hasVideo ? scheduleDate : new Date(scheduleDate.getTime() - PUBLICATION_PREPARATION_MS);
  }

  static isApprovedVideo (contentStatus: string, revision: number, videoStatus: string, videoRevision: number) {
    return (contentStatus === 'APPROVED' || contentStatus === 'READY') &&
      videoStatus === 'APPROVED' && revision === videoRevision;
  }

  static nextRenderStep (generationStatus: PublicationVideoState['generationStatus'], scheduleDate: Date, now: number) {
    if (!PublicationPolicy.isWithinGraceWindow(scheduleDate, now)) return 'expire';

    switch (generationStatus) {
      case null: return 'request-render';
      case 'PENDING_SCRIPT':
      case 'PENDING': return 'submit-pending-render';
      case 'FAILED': return 'reject-render';
      case 'SCRIPT_GENERATING':
      case 'SUBMITTING':
      case 'RENDERING':
      case 'READY': return 'wait-for-video';
    }
  }
}
