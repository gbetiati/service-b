import { PUBLICATION_GRACE_MS } from './publication-timing';

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

  static isApprovedVideo (contentStatus: string, revision: number, videoStatus: string, videoRevision: number) {
    return (contentStatus === 'APPROVED' || contentStatus === 'READY') &&
      videoStatus === 'APPROVED' && revision === videoRevision;
  }
}
