import { Publication, PublicationWork } from '../entities/publication.entity';

export type ScheduleInput = { contentId: string; videoId?: string; socialAccountId: string; date: Date; caption?: string };

export abstract class PublicationRepository {
  abstract create(input: ScheduleInput): Promise<Publication>;
  abstract findById(id: string): Promise<Publication | null>;
  abstract pendingJobs(): Promise<{ id: string; nextAttemptAt: Date }[]>;
  abstract claim(id: string): Promise<PublicationWork | null>;
  abstract waitForVideo(job: PublicationWork): Promise<void>;
  abstract resumeForContent(companyId: string, contentId: string, revision: number): Promise<void>;
  abstract markReady(job: PublicationWork, videoId: string): Promise<void>;
  abstract defer(job: PublicationWork, containerId?: string, nextAttemptAt?: Date): Promise<void>;
  abstract succeed(job: PublicationWork, externalId?: string): Promise<void>;
  abstract fail(job: PublicationWork, reason: string): Promise<void>;
}
