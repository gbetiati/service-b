import { EncryptedToken } from '@/modules/social-account/domain/entities/social-credential.entity';
import { VideoStatus } from '@/modules/video-generation/domain/entities/video-generation.entity';
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
  nextAttemptAt: Date;
  accountExternalId: string;
  accountActive: boolean;
  credential: (EncryptedToken & { expiresAt: Date | null }) | null;
};

export type PublicationVideoState = {
  generationStatus: VideoStatus | null;
  approved: boolean;
  video: { id: string; storageKey: string } | null;
};
