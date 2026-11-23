import type { Content, ContentReferences } from '../entities/content.entity';

export type ContentHistory = { revision: number; snapshot: unknown; createdAt: Date };

export abstract class ContentRepository {
  abstract create (content: Content): Promise<Content>;

  abstract update (content: Content, publicationPreparationRequested?: boolean): Promise<Content>;

  abstract findById (id: string): Promise<Content | null>;

  abstract findReferences (content: Content): Promise<ContentReferences>;

  abstract findAll (offset: number, limit: number): Promise<Content[]>;

  abstract findHistory (id: string, offset: number, limit: number): Promise<ContentHistory[]>;
}
