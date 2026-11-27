const assert = require('node:assert/strict');
const { test } = require('node:test');
const { Logger } = require('@nestjs/common');
const sharp = require('sharp');
const { RequestContext } = require('../dist/shared/core/request-context/request-context');
const { UploadBrandLogoUseCase } = require('../dist/modules/brand/application/use-cases/upload-brand-logo.usecase');
const { RemoveBrandLogoUseCase } = require('../dist/modules/brand/application/use-cases/remove-brand-logo.usecase');
const { GetBrandLogoUrlUseCase } = require('../dist/modules/brand/application/use-cases/get-brand-logo-url.usecase');
const { SharpLogoImageProcessor } = require('../dist/modules/brand/infra/providers/sharp-logo-image-processor.provider');

Logger.overrideLogger(false);

function harness (initialLogo = null) {
  const brand = { id: 'brand-1', name: 'Marca', logoStorageKey: initialLogo };
  const objects = new Map(initialLogo ? [[initialLogo, Buffer.from('old')]] : []);
  const repository = {
    findById: async id => (id === brand.id ? { ...brand } : null),
    updateLogo: async (id, key) => { if (id !== brand.id) return null; const previous = brand.logoStorageKey; brand.logoStorageKey = key; return { previous }; },
  };
  const storage = {
    put: async (key, body, type) => { objects.set(key, { body, type }); },
    remove: async key => { objects.delete(key); },
    url: async key => `https://storage.test/${key}?signed`,
  };
  const context = new RequestContext();
  return { brand, objects, repository, storage, context, processor: { normalize: async () => Buffer.from('png') } };
}

test('uploading a logo stores a PNG under the brand folder, points the brand to it and removes the previous file', async () => {
  const h = harness('company-a/brands/brand-1/logo-old.png');
  const saved = await h.context.runForCompany('company-a', () => new UploadBrandLogoUseCase(h.repository, h.processor, h.storage, h.context).execute('brand-1', Buffer.from('input')));
  assert.match(saved.logoStorageKey, /^company-a\/brands\/brand-1\/logo-[0-9a-f-]{36}\.png$/);
  assert.equal(h.objects.get(saved.logoStorageKey).type, 'image/png');
  assert.equal(h.objects.has('company-a/brands/brand-1/logo-old.png'), false, 'the replaced logo is removed from the storage');
});

test('a logo upload for a missing brand stores nothing', async () => {
  const h = harness();
  await assert.rejects(h.context.runForCompany('company-a', () => new UploadBrandLogoUseCase(h.repository, h.processor, h.storage, h.context).execute('outra', Buffer.from('x'))), error => error.kind === 'missing');
  assert.equal(h.objects.size, 0);
});

test('removing the logo clears the brand and the file, and the URL route answers not found without a logo', async () => {
  const h = harness('company-a/brands/brand-1/logo-1.png');
  assert.deepEqual(await new GetBrandLogoUrlUseCase(h.repository, h.storage).execute('brand-1'), { url: 'https://storage.test/company-a/brands/brand-1/logo-1.png?signed' });
  await new RemoveBrandLogoUseCase(h.repository, h.storage).execute('brand-1');
  assert.equal(h.brand.logoStorageKey, null);
  assert.equal(h.objects.size, 0);
  await new RemoveBrandLogoUseCase(h.repository, h.storage).execute('brand-1');
  await assert.rejects(new GetBrandLogoUrlUseCase(h.repository, h.storage).execute('brand-1'), error => error.kind === 'missing' && /não tem logo/.test(error.message));
  await assert.rejects(new RemoveBrandLogoUseCase(h.repository, h.storage).execute('outra'), error => error.kind === 'missing');
});

test('SharpLogoImageProcessor keeps transparency, limits the size and rejects files that are not images', async () => {
  const transparent = await sharp({ create: { width: 2000, height: 1000, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
  const output = await new SharpLogoImageProcessor().normalize(transparent);
  const meta = await sharp(output).metadata();
  assert.deepEqual([meta.format, meta.width, meta.height, meta.hasAlpha], ['png', 1024, 512, true]);
  await assert.rejects(new SharpLogoImageProcessor().normalize(Buffer.from('não é imagem')), error => error.kind === 'invalid');
});
