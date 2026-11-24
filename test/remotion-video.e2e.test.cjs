const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { writeFileSync } = require('node:fs');
const { createServer } = require('node:net');
const { Readable } = require('node:stream');
const { setTimeout: delay } = require('node:timers/promises');
const { test } = require('node:test');
const { ValidationPipe } = require('@nestjs/common');
const { Test } = require('@nestjs/testing');
const sharp = require('sharp');

async function freePort () {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise(resolve => server.close(resolve));
  return port;
}

test('remotion provider: render in background, signed internal webhook and preparation ready for publication', { timeout: 60_000 }, async () => {
  assert.ok(process.env.TEST_DATABASE_URL, 'Configure TEST_DATABASE_URL with a dedicated test instance.');
  const port = await freePort();
  Object.assign(process.env, {
    DATABASE_URL: process.env.TEST_DATABASE_URL, JWT_SECRET: randomUUID() + randomUUID(), NODE_ENV: 'test', PORT: String(port),
    VIDEO_PROVIDER: 'remotion', VIDEO_REVIEW_ENABLED: 'true', ANTHROPIC_API_KEY: 'test-key',
    REMOTION_WEBHOOK_SECRET: 'whsec_' + Buffer.from(randomUUID()).toString('base64'),
  });
  const { AppModule } = require('../dist/app.module');
  const { PrismaService } = require('../dist/prisma/prisma.service');
  const { AppErrorFilter } = require('../dist/shared/core/errors/app-error.filter');
  const { StorageProvider } = require('../dist/shared/libs/storage/storage.provider');
  const { CopyWriterProvider } = require('../dist/modules/video-generation/domain/providers/copy-writer.provider');
  const { VideoReviewProvider } = require('../dist/modules/video-generation/domain/providers/video-review.provider');
  const { RemotionCliRenderer } = require('../dist/modules/video-generation/infra/remotion/remotion-cli.renderer');

  const objects = new Map();
  const renders = [];
  const briefs = [];
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(StorageProvider).useValue({
      put: async (key, body) => {
        const chunks = [];
        for await (const chunk of Buffer.isBuffer(body) ? [body] : body) chunks.push(chunk);
        objects.set(key, Buffer.concat(chunks));
      },
      open: async key => Readable.from([objects.get(key)]),
      url: async key => 'https://storage.invalid/' + key,
      remove: async key => { objects.delete(key); },
    })
    .overrideProvider(CopyWriterProvider).useValue({
      write: async brief => {
        briefs.push(brief);
        return { headline: 'Corra mais leve', bullets: ['Amortecimento macio', 'Cabedal respirável'], cta: 'Garanta o seu' };
      },
    })
    .overrideProvider(RemotionCliRenderer).useValue({
      render: async input => {
        renders.push(input);
        writeFileSync(input.outputPath, 'remotion mp4');
      },
    })
    .overrideProvider(VideoReviewProvider).useValue({
      review: async video => {
        const chunks = [];
        for await (const chunk of video) chunks.push(chunk);
        assert.equal(Buffer.concat(chunks).toString(), 'remotion mp4');
        return { status: 'APPROVED', reason: 'Produto confere.', ocr: [] };
      },
    })
    .compile();

  const app = module.createNestApplication({ rawBody: true });
  const db = app.get(PrismaService);
  let companyId;
  try {
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new AppErrorFilter());
    await app.listen(port, '127.0.0.1');
    const base = `http://127.0.0.1:${port}`;

    async function call (route, { method = 'GET', token, body, status = 200 } = {}) {
      const headers = {};
      if (token) headers.Authorization = 'Bearer ' + token;
      if (body && !(body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(body);
      }
      const response = await fetch(base + route, { method, headers, body });
      const text = await response.text();
      const data = text ? JSON.parse(text) : undefined;
      assert.equal(response.status, status, method + ' ' + route + ' ' + text);
      return data;
    }
    const post = (route, token, body, status = 201) => call(route, { method: 'POST', token, body, status });

    async function poll (read, done) {
      for (let attempt = 0; attempt < 60; attempt++) {
        const value = await read();
        if (done(value)) return value;
        await delay(250);
      }
      assert.fail('Expected state was not reached');
    }

    const signup = await post('/auth/signup', undefined, { companyName: 'Empresa Remotion', email: randomUUID() + '@example.com', password: 'sua-senha-de-teste' });
    companyId = signup.companyId;
    const token = signup.accessToken;
    const brand = await post('/brands', token, { name: 'Marca Run' });
    const product = await post('/products', token, { brandId: brand.id, name: 'Tênis Run', description: 'Leve', price: 199.9, oldPrice: 249.9 });
    const campaign = await post('/campaigns', token, { brandId: brand.id, name: 'Lançamento' });
    const rules = await post('/campaign-rules', token, { campaingId: campaign.id, name: 'Regra', guidelines: 'Usar fotos reais.' });
    const file = new FormData();
    const image = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#224466' } }).png().toBuffer();
    file.set('file', new Blob([image], { type: 'image/png' }), 'reference.png');
    const asset = await post('/products/' + product.id + '/media', token, file);
    const content = await post('/contents', token, {
      campaingId: campaign.id, campaingRulesId: rules.id, productId: product.id, mediaAssetIds: [asset.id], aiScript: 'Roteiro já aprovado.',
    });

    const preparePath = '/publications/contents/' + content.id + '/prepare';
    assert.deepEqual(await post(preparePath, token, undefined, 202), { contentId: content.id, revision: 1, status: 'PENDING' });

    const prepared = await poll(() => call('/contents/' + content.id, { token }), value => value.videoStatus === 'READY');
    assert.equal(prepared.status, 'READY');
    assert.equal(prepared.transcriptionStatus, 'READY', 'video without speech skips transcription');
    assert.equal(prepared.subtitleStatus, 'READY');
    assert.equal(prepared.transcription, '');

    assert.deepEqual(briefs, [{ name: 'Tênis Run', description: 'Leve', brand: 'Marca Run' }]);
    assert.equal(renders.length, 1);
    assert.equal(renders[0].compositionId, 'ProductAd-9x16');
    assert.equal(renders[0].props.product.price, 'R$ 199,90');
    assert.equal(renders[0].props.product.oldPrice, 'R$ 249,90');
    assert.equal(renders[0].props.copy.headline, 'Corra mais leve');
    assert.match(renders[0].props.product.imageUrl, new RegExp(`^https://storage.invalid/${companyId}/products/${product.id}/`));

    const generation = await call('/contents/' + content.id + '/video-generations', { token });
    assert.equal(generation.status, 'READY');
    assert.equal(generation.video.review.status, 'APPROVED');
    assert.equal(generation.video.captionedUrl, null);
    assert.ok(generation.video.url.endsWith(`${companyId}/contents/${content.id}/videos/${generation.id}.mp4`));
    assert.equal(objects.get(`${companyId}/contents/${content.id}/videos/${generation.id}.mp4`).toString(), 'remotion mp4');
    await poll(async () => [...objects.keys()], keys => !keys.some(key => key.startsWith('remotion-renders/')));

    const ready = await post(preparePath, token, undefined, 202);
    assert.equal(ready.status, 'READY');
    assert.equal(ready.videoId, generation.video.id);
  } finally {
    if (companyId) await db.company.deleteMany({ where: { id: companyId } });
    await app.close();
  }
});
