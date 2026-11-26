import type { Content, ContentReferences } from '../entities/content.entity';
import type { ContentStatus } from '../entities/content-status';

export type ContentListFilters = { search?: string; productId?: string; status?: ContentStatus };

export type ContentHistory = { revision: number; snapshot: unknown; createdAt: Date };

export abstract class ContentRepository {
  abstract create (content: Content): Promise<Content>;

  abstract update (content: Content, publicationPreparationRequested?: boolean): Promise<Content>;

  abstract findById (id: string): Promise<Content | null>;

  abstract findReferences (content: Content): Promise<ContentReferences>;

  abstract findAll (offset: number, limit: number, filters?: ContentListFilters): Promise<Content[]>;

  abstract findHistory (id: string, offset: number, limit: number): Promise<ContentHistory[]>;

  // Exclui o conteúdo com vídeos, histórico e agendamentos. Devolve as chaves dos vídeos no storage, ou null se não existir.
  abstract delete (id: string): Promise<string[] | null>;
}
