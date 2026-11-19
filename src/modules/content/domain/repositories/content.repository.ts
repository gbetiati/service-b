import { Content } from '../entities/content.entity';

export type ContentHistory = { revision: number; snapshot: unknown; createdAt: Date };

export abstract class ContentRepository {
  abstract create (content: Content): Promise<Content>;

  abstract update (content: Content): Promise<Content>;

  abstract findById (id: string): Promise<Content | null>;

  abstract findAll (offset: number, limit: number): Promise<Content[]>;

  abstract findHistory (id: string, offset: number, limit: number): Promise<ContentHistory[]>;
}
