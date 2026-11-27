const assert = require('node:assert/strict');
const { test } = require('node:test');
const { ProductAdPolicy } = require('../dist/modules/video-generation/domain/entities/product-ad');
const { PRODUCT_AD_TEMPLATES } = require('../dist/modules/video-generation/infra/remotion/product-ad.compositions');
const { ListImageTemplatesUseCase } = require('../dist/modules/image-template/application/use-cases/list-image-templates.usecase');
const { SaveImageTemplateSettingUseCase } = require('../dist/modules/image-template/application/use-cases/save-image-template-setting.usecase');
const { ResetImageTemplateSettingUseCase } = require('../dist/modules/image-template/application/use-cases/reset-image-template-setting.usecase');
const { UpdateMediaAssetKindUseCase } = require('../dist/modules/media-asset/application/use-cases/update-media-asset-kind.usecase');

const photo = (url, kind) => ({ url, kind });

test('arrangeImages keeps the content order when the template has no setting', () => {
  const images = [photo('a', 'PERSON'), photo('b', 'PRODUCT'), photo('c', 'PRODUCT'), photo('d', 'PERSON')];
  assert.deepEqual(ProductAdPolicy.arrangeImages(images), ['a', 'b', 'c']);
  assert.deepEqual(ProductAdPolicy.arrangeImages(images, null), ['a', 'b', 'c']);
  assert.deepEqual(ProductAdPolicy.arrangeImages([]), []);
});

test('arrangeImages gives each scene the first unused photo of the kind it prefers, in content order', () => {
  const images = [photo('produto-1', 'PRODUCT'), photo('produto-2', 'PRODUCT'), photo('pessoa-1', 'PERSON'), photo('pessoa-2', 'PERSON')];
  assert.deepEqual(ProductAdPolicy.arrangeImages(images, ['PERSON', 'PRODUCT', 'PERSON']), ['pessoa-1', 'produto-1', 'pessoa-2']);
  assert.deepEqual(ProductAdPolicy.arrangeImages(images, ['PRODUCT', 'PERSON', 'PRODUCT']), ['produto-1', 'pessoa-1', 'produto-2']);
});

test('arrangeImages falls back to any unused photo, then repeats one of the preferred kind', () => {
  const images = [photo('produto-1', 'PRODUCT'), photo('pessoa-1', 'PERSON')];
  assert.deepEqual(ProductAdPolicy.arrangeImages(images, ['PERSON', 'PERSON', 'PERSON']), ['pessoa-1', 'produto-1', 'pessoa-1'], 'a second person photo is missing: the unused product photo comes in, then the person photo repeats');
  assert.deepEqual(ProductAdPolicy.arrangeImages([photo('so-uma')], ['PERSON', 'PRODUCT', 'PRODUCT']), ['so-uma', 'so-uma', 'so-uma'], 'with one photo every scene uses it');
  assert.deepEqual(ProductAdPolicy.arrangeImages([photo('sem-tipo'), photo('pessoa', 'PERSON')], ['PRODUCT', 'PERSON', 'PRODUCT']), ['sem-tipo', 'pessoa', 'sem-tipo'], 'a photo without kind counts as product');
});

function memoryRepository (initial = []) {
  const rows = [...initial];
  return {
    rows,
    findAll: async () => rows,
    save: async (template, slotKinds) => { const row = { template, slotKinds, updatedAt: new Date() }; rows.splice(0, rows.length, ...rows.filter(item => item.template !== template), row); return row; },
    remove: async template => { const before = rows.length; rows.splice(0, rows.length, ...rows.filter(item => item.template !== template)); return rows.length < before; },
  };
}

test('image template settings list every photo template, save a setting and reset it to the content order', async () => {
  const repository = memoryRepository();
  const list = () => new ListImageTemplatesUseCase(repository).execute();
  assert.deepEqual((await list()).map(item => item.template), [...PRODUCT_AD_TEMPLATES]);
  assert.ok((await list()).every(item => item.slotKinds === null), 'no setting means the content order');

  await new SaveImageTemplateSettingUseCase(repository).execute('ProductAdNative', ['PERSON', 'PRODUCT', 'PRODUCT']);
  assert.deepEqual((await list()).find(item => item.template === 'ProductAdNative').slotKinds, ['PERSON', 'PRODUCT', 'PRODUCT']);

  await new ResetImageTemplateSettingUseCase(repository).execute('ProductAdNative');
  await new ResetImageTemplateSettingUseCase(repository).execute('ProductAdNative');
  assert.equal((await list()).find(item => item.template === 'ProductAdNative').slotKinds, null);

  const missing = error => error.kind === 'missing' && /Template de foto/.test(error.message);
  await assert.rejects(new SaveImageTemplateSettingUseCase(repository).execute('VideoAdCaptions', ['PERSON', 'PERSON', 'PERSON']), missing, 'video templates have no photo scenes');
  await assert.rejects(new ResetImageTemplateSettingUseCase(repository).execute('../x'), missing);
});

test('UpdateMediaAssetKindUseCase answers not found outside the company', async () => {
  const updated = await new UpdateMediaAssetKindUseCase({ updateKind: async (id, kind) => (id === 'a' ? { id, kind } : null) }).execute('a', 'PERSON');
  assert.deepEqual(updated, { id: 'a', kind: 'PERSON' });
  await assert.rejects(new UpdateMediaAssetKindUseCase({ updateKind: async () => null }).execute('b', 'PRODUCT'), error => error.kind === 'missing');
});
