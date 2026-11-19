import type { ContentStatus } from '@/modules/content/domain/entities/content-status';
import type { PublicationRepository } from '../../domain/repositories/publication.repository';

export interface PublicationSchedulingSession {
  findContent (id: string): Promise<{ status: ContentStatus; revision: number; editorial: { caption?: string } } | null>;

  findVideo (contentId: string, id: string): Promise<{ reviewStatus: ContentStatus; revision: number } | null>;

  findSocialAccount (id: string): Promise<{ active: boolean; credentials: { expiresAt: Date | null }[] } | null>;

  publicationRepository: Pick<PublicationRepository, 'save'>;
}

export abstract class PublicationSchedulingTransaction {
  abstract run<T> (companyId: string, work: (session: PublicationSchedulingSession) => Promise<T>): Promise<T>;
}
