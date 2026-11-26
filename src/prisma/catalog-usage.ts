import { Prisma } from '@prisma/client';
import { AppError } from '@/shared/core/errors/app.error';

type CatalogRefs = { campaignIds?: string[]; productIds?: string[] };

// Conteúdos e agendamentos ainda sem conteúdo (rascunho em contentDraft) que dependem de campanhas ou produtos.
// Excluir algo em uso apagaria conteúdos em cascata ou deixaria o rascunho sem referência na hora de criar o conteúdo.
export async function assertCatalogUnused (tx: Prisma.TransactionClient, companyId: string, refs: CatalogRefs, subject: string) {
  const campaignIds = refs.campaignIds ?? [];
  const productIds = refs.productIds ?? [];

  if (!campaignIds.length && !productIds.length) return;

  const usedBy: Prisma.ContentWhereInput[] = [
    { campaingId: { in: campaignIds } }, { productId: { in: productIds } },
    { products: { some: { productId: { in: productIds } } } }, { assets: { some: { mediaAsset: { productId: { in: productIds } } } } },
  ];
  const draftRefs: Prisma.ContentScheduledWhereInput[] = [
    ...campaignIds.map(id => ({ contentDraft: { path: ['campaingId'], equals: id } })),
    ...productIds.map(id => ({ contentDraft: { path: ['productId'], equals: id } })),
  ];
  const contents = await tx.content.count({ where: { companyId, OR: usedBy } });
  const drafts = await tx.contentScheduled.count({ where: { companyId, contentId: null, status: 'WAITING', OR: draftRefs } });

  if (!contents && !drafts) return;

  const parts = [contents && plural(contents, 'conteúdo', 'conteúdos'), drafts && plural(drafts, 'agendamento ainda sem conteúdo', 'agendamentos ainda sem conteúdo')].filter(Boolean);
  throw new AppError('conflict', `${subject} em ${parts.join(' e ')}. Exclua-os antes.`);
}

function plural (count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}
