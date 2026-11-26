const assert = require('node:assert/strict');
const { test } = require('node:test');
const { Logger } = require('@nestjs/common');
const { AppError } = require('../dist/shared/core/errors/app.error');
const { assertCatalogUnused } = require('../dist/prisma/catalog-usage');
const { DeleteBrandUseCase } = require('../dist/modules/brand/application/use-cases/delete-brand.usecase');
const { DeleteCampaignUseCase } = require('../dist/modules/campaign/application/use-cases/delete-campaign.usecase');
const { DeleteProductUseCase } = require('../dist/modules/product/application/use-cases/delete-product.usecase');
const { DeleteContentUseCase } = require('../dist/modules/content/application/use-cases/delete-content.usecase');

Logger.overrideLogger(false);

function storage (failing = []) {
  const removed = [];
  return { removed, remove: async key => { if (failing.includes(key)) throw new Error('storage fora'); removed.push(key); } };
}

test('delete use cases remove the stored files of the deleted record, and one storage failure does not fail the request', async () => {
  const brandStorage = storage(['media/b.jpg']);
  await new DeleteBrandUseCase({ delete: async id => (assert.equal(id, 'brand-1'), ['media/a.jpg', 'media/b.jpg']) }, brandStorage).execute('brand-1');
  assert.deepEqual(brandStorage.removed, ['media/a.jpg'], 'the record is already gone, so a file left behind only goes to the log');

  const productStorage = storage();
  await new DeleteProductUseCase({ delete: async () => ['media/c.jpg'] }, productStorage).execute('product-1');
  assert.deepEqual(productStorage.removed, ['media/c.jpg']);

  const contentStorage = storage();
  await new DeleteContentUseCase({ delete: async () => ['videos/1.mp4', 'videos/1.captioned.mp4'] }, contentStorage).execute('content-1');
  assert.deepEqual(contentStorage.removed, ['videos/1.mp4', 'videos/1.captioned.mp4']);

  await new DeleteCampaignUseCase({ delete: async () => true }).execute('campaign-1');
});

test('delete use cases answer not found when the record does not exist in the company', async () => {
  const missing = message => error => error instanceof AppError && error.kind === 'missing' && error.message === message;
  await assert.rejects(new DeleteBrandUseCase({ delete: async () => null }, storage()).execute('x'), missing('Marca não encontrada.'));
  await assert.rejects(new DeleteCampaignUseCase({ delete: async () => false }).execute('x'), missing('Campanha não encontrada.'));
  await assert.rejects(new DeleteProductUseCase({ delete: async () => null }, storage()).execute('x'), missing('Produto não encontrado.'));
  await assert.rejects(new DeleteContentUseCase({ delete: async () => null }, storage()).execute('x'), missing('Conteúdo não encontrado.'));
});

test('assertCatalogUnused refuses while contents or pending drafts depend on the campaigns or products', async () => {
  const queries = [];
  const tx = (contents, drafts) => ({
    content: { count: async args => (queries.push(['content', args]), contents) },
    contentScheduled: { count: async args => (queries.push(['draft', args]), drafts) },
  });

  await assertCatalogUnused(tx(0, 0), 'company-a', { campaignIds: ['c1'], productIds: ['p1', 'p2'] }, 'A marca é usada');
  const [[, contentQuery], [, draftQuery]] = queries;
  assert.equal(contentQuery.where.companyId, 'company-a');
  assert.deepEqual(contentQuery.where.OR[0], { campaingId: { in: ['c1'] } });
  assert.deepEqual(contentQuery.where.OR[2], { products: { some: { productId: { in: ['p1', 'p2'] } } } });
  assert.deepEqual(draftQuery.where, {
    companyId: 'company-a', contentId: null, status: 'WAITING',
    OR: [{ contentDraft: { path: ['campaingId'], equals: 'c1' } }, { contentDraft: { path: ['productId'], equals: 'p1' } }, { contentDraft: { path: ['productId'], equals: 'p2' } }],
  });

  const conflict = message => error => error instanceof AppError && error.kind === 'conflict' && error.message === message;
  await assert.rejects(assertCatalogUnused(tx(2, 1), 'company-a', { productIds: ['p1'] }, 'O produto é usado'),
    conflict('O produto é usado em 2 conteúdos e 1 agendamento ainda sem conteúdo. Exclua-os antes.'));
  await assert.rejects(assertCatalogUnused(tx(1, 0), 'company-a', { campaignIds: ['c1'] }, 'A campanha é usada'),
    conflict('A campanha é usada em 1 conteúdo. Exclua-os antes.'));

  queries.length = 0;
  await assertCatalogUnused(tx(5, 5), 'company-a', { campaignIds: [], productIds: [] }, 'A marca é usada');
  assert.equal(queries.length, 0, 'a brand without campaigns or products has nothing to check');
});
