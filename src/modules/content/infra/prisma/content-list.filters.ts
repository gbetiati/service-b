import type { Prisma } from '@prisma/client';
import type { ContentListFilters } from '../../domain/repositories/content.repository';

export function contentSelectionFilter ({ productId, status }: ContentListFilters): Prisma.ContentWhereInput {
  return {
    status,
    ...(productId ? { OR: [{ productId }, { products: { some: { productId } } }] } : {}),
  };
}
