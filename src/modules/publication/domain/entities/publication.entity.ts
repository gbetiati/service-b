import type { PreparationStatus } from '@/modules/content/domain/entities/content.entity';
import { EncryptedToken } from '@/modules/social-account/domain/entities/social-credential.entity';
import { ContentScheduled } from './content-scheduled.entity';

export type PublicationStatus = 'SCHEDULED' | 'PUBLISHING' | 'PUBLISHED' | 'FAILED';

export type Publication = {
  id: string;
  companyId: string;
  status: PublicationStatus;
  socialAccountId: string;
  caption: string | null;
  containerId: string | null;
  externalId: string | null;
  error: string | null;
  schedule: ContentScheduled;
};

export type PublicationWork = Publication & {
  leaseUntil: Date;
  accountExternalId: string;
  accountActive: boolean;
  credential: (EncryptedToken & { expiresAt: Date | null }) | null;
};

export type PublicationVideoState = {
  scriptStatus: PreparationStatus;
  videoStatus: PreparationStatus;
  transcriptionStatus: PreparationStatus;
  subtitleStatus: PreparationStatus;
  revision: number;
  approved: boolean;
  video: { id: string; storageKey: string } | null;
};
