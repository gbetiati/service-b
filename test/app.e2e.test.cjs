const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Readable } = require('node:stream');
const { setTimeout: delay } = require('node:timers/promises');
const { test } = require('node:test');
const { ValidationPipe } = require('@nestjs/common');
const { Test } = require('@nestjs/testing');
const sharp = require('sharp');

test('company onboarding through reviewed and scheduled video publication', { timeout: 70_000 }, async () => {
  assert.ok(process.env.TEST_DATABASE_URL && process.env.TEST_REDIS_URL, 'Configure TEST_DATABASE_URL and TEST_REDIS_URL with dedicated test instances.');
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.REDIS_URL = process.env.TEST_REDIS_URL;
  process.env.JWT_SECRET = randomUUID() + randomUUID();
  process.env.SOCIAL_CREDENTIAL_KEY = Buffer.alloc(32, 42).toString('base64');
  process.env.INSTAGRAM_APP_ID = 'test-app';
  process.env.INSTAGRAM_APP_SECRET = 'test-secret';
  process.env.INSTAGRAM_GRAPH_VERSION = 'v27.0';
  process.env.INSTAGRAM_REDIRECT_URI = 'http://127.0.0.1/social-accounts/instagram/callback';
  const { AppModule } = require('../dist/app.module');
  const { PrismaService } = require('../dist/prisma/prisma.service');
  const { AppErrorFilter } = require('../dist/shared/core/errors/app-error.filter');
  const { ExternalApiProvider } = require('../dist/shared/libs/http/external-api.provider');
  const { OpenAiService } = require('../dist/shared/libs/ai/open-ai.service');
  const { StorageProvider } = require('../dist/shared/libs/storage/storage.provider');
  const { VideoProvider } = require('../dist/modules/video-generation/domain/providers/video.provider');
  const { VideoReviewProvider } = require('../dist/modules/video-generation/domain/providers/video-review.provider');

  const objects = new Map();
  let publishes = 0;
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
    .overrideProvider(OpenAiService).useValue({ complete: async () => 'Roteiro criado pela IA.' })
    .overrideProvider(VideoProvider).useValue({
      render: async input => {
        assert.equal(input.script, 'Roteiro revisado.');
        assert.equal(input.imageUrls.length, 1);
        return randomUUID();
      },
      status: async () => ({ state: 'ready', url: 'https://cdn.invalid/render.mp4' }),
      download: async () => Readable.from([Buffer.from('test mp4')]),
    })
    .overrideProvider(VideoReviewProvider).useValue({
      review: async (video, render, references) => {
        const chunks = [];
        for await (const chunk of video) chunks.push(chunk);
        assert.equal(Buffer.concat(chunks).toString(), 'test mp4');
        assert.equal(render.brief.brand, 'Marca A');
        assert.equal(references.length, 1);
        return { status: 'APPROVED', reason: 'Produtos conferem.', ocr: [] };
      },
    })
    .overrideProvider(ExternalApiProvider).useValue({
      json: async (address, request) => {
        const url = new URL(address);
        if (url.hostname === 'api.instagram.com') {
          assert.equal(request.body.get('code'), 'accepted-code');
          return { data: [{ access_token: 'short-lived', permissions: 'instagram_business_basic,instagram_business_content_publish' }] };
        }
        if (url.pathname === '/access_token') return { access_token: 'instagram-long-token', expires_in: 86400 };
        assert.equal(request.headers.Authorization, 'Bearer instagram-long-token');
        if (url.pathname.endsWith('/me')) return { user_id: 'test-profile', username: 'test_business' };
        if (url.pathname.endsWith('/media')) {
          assert.equal(request.body.get('media_type'), 'REELS');
          assert.equal(request.body.get('caption'), 'Legenda de catálogo');
          return { id: 'test-container' };
        }
        if (url.pathname.endsWith('/test-container')) return { status_code: 'FINISHED' };
        if (url.pathname.endsWith('/media_publish')) {
          assert.equal(request.body.get('creation_id'), 'test-container');
          publishes++;
          return { id: 'test-reel' };
        }
        throw new Error('Unexpected Instagram endpoint: ' + url.pathname);
      },
    })
    .compile();

  const app = module.createNestApplication();
  const db = app.get(PrismaService);
  const companies = [];
  try {
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new AppErrorFilter());
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl();

    async function request(route, { method = 'GET', token, body, cookie, status = 200 } = {}) {
      const headers = {};
      if (token) headers.Authorization = 'Bearer ' + token;
      if (cookie) headers.Cookie = cookie;
      if (body && !(body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(body);
      }
      const response = await fetch(base + route, { method, headers, body });
      const data = await response.json();
      assert.equal(response.status, status, method + ' ' + route + ' ' + JSON.stringify(data));
      return { data, cookie: response.headers.get('set-cookie')?.split(';')[0] };
    }

    const post = async (route, token, body, status = 201) => (await request(route, { method: 'POST', token, body, status })).data;
    const get = async (route, token, status = 200) => (await request(route, { token, status })).data;
    async function poll(read, done) {
      for (let attempt = 0; attempt < 80; attempt++) {
        const value = await read();
        if (done(value)) return value;
        await delay(300);
      }
      assert.fail('Expected background job state was not reached');
    }

    const email = randomUUID() + '@example.com';
    const password = 'sua-senha-de-teste';
    const a = await post('/auth/signup', undefined, { companyName: 'Empresa A', email, password });
    companies.push(a.companyId);
    const b = await post('/auth/signup', undefined, { companyName: 'Empresa B', email: randomUUID() + '@example.com', password });
    companies.push(b.companyId);
    const { accessToken: token } = await post('/auth/login', undefined, { email, password }, 200);
    const other = b.accessToken;
    await post('/auth/login', undefined, { email, password: 'senha-incorreta-aqui' }, 401);
    await get('/companies/me', undefined, 401);
    const companyRequests = Array.from({ length: 12 }, (_, index) => {
      const identity = index % 2 ? b : a;
      return get('/companies/me', identity.accessToken).then(company => assert.equal(company.id, identity.companyId));
    });
    await Promise.all(companyRequests);
    const brand = await post('/brands', token, { name: 'Marca A' });
    assert.deepEqual(await get('/brands', other), []);
    await get('/brands/' + brand.id, other, 404);
    await post('/brands', token, { name: 'Malicioso', companyId: b.companyId }, 400);
    await post('/campaigns', other, { brandId: brand.id, name: 'Outra empresa' }, 404);
    await assert.rejects(
      db.product.create({ data: { companyId: b.companyId, brandId: brand.id, name: 'Vínculo inválido' } }),
      { code: 'P2003' },
    );
    const category = await post('/product-categories', token, { name: 'Categoria A' });
    const product = await post('/products', token, { brandId: brand.id, categoryId: category.id, name: 'Produto A' });
    const accessory = await post('/products', token, { brandId: brand.id, name: 'Produto complementar' });
    const campaign = await post('/campaigns', token, { brandId: brand.id, name: 'Campanha A' });
    const rules = await post('/campaign-rules', token, { campaingId: campaign.id, name: 'Regra A', guidelines: 'Usar fotos reais.' });

    const file = new FormData();
    const image = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#224466' } }).png().toBuffer();
    file.set('file', new Blob([image], { type: 'image/png' }), 'reference.png');
    const asset = await post('/products/' + product.id + '/media', token, file);
    await get('/media-assets/' + asset.id + '/url', other, 404);
    assert.equal((await get('/products/' + product.id + '/media', token))[0].id, asset.id);
    const content = await post('/contents', token, {
      campaingId: campaign.id, campaingRulesId: rules.id, productId: product.id, productIds: [accessory.id],
      mediaAssetIds: [asset.id], editorial: { caption: 'Legenda de catálogo' },
    });
    assert.equal(content.aiScript, 'Roteiro criado pela IA.');
    await get('/contents/' + content.id, other, 404);
    const patch = body => request('/contents/' + content.id, { method: 'PATCH', token, ...body });
    const changed = await patch({ body: { revision: 1, aiScript: 'Roteiro revisado.' } });
    assert.equal(changed.data.revision, 2);
    await patch({ body: { revision: 1, aiScript: 'Obsoleto' }, status: 409 });
    const history = await get('/contents/' + content.id + '/history', token);
    assert.deepEqual(history.map(item => item.revision), [2, 1]);
    assert.equal(history[1].snapshot.aiScript, 'Roteiro criado pela IA.');

    const { data: connection, cookie } = await request('/social-accounts/instagram/connect', { method: 'POST', token, status: 201 });
    assert.ok(cookie);
    const state = new URL(connection.authorizationUrl).searchParams.get('state');
    const callback = '/social-accounts/instagram/callback?code=accepted-code&state=' + state;
    await get(callback, undefined, 400);
    const { data: account } = await request(callback, { cookie });
    assert.equal(account.accountHandle, 'test_business');
    await request(callback, { cookie, status: 400 });
    assert.deepEqual(await get('/social-accounts', other), []);
    const credential = await db.socialCredential.findFirstOrThrow({ where: { socialAccountId: account.id } });
    assert.notEqual(credential.encryptedValue, 'instagram-long-token');
    assert.equal(account.encryptedValue, undefined);

    const generation = await post('/contents/' + content.id + '/video-generations', token, undefined, 202);
    const repeated = await post('/contents/' + content.id + '/video-generations', token, undefined, 202);
    assert.equal(repeated.id, generation.id);
    await get('/video-generations/' + generation.id, other, 404);
    const render = await poll(() => get('/video-generations/' + generation.id, token), value => value.status === 'READY');
    assert.equal(render.video.review.status, 'APPROVED');
    assert.equal((await get('/contents/' + content.id, token)).status, 'APPROVED');
    const publication = await post('/publications', token, {
      contentId: content.id, videoId: render.video.id, socialAccountId: account.id,
      date: new Date(Date.now() + 1000).toISOString(),
    });
    await get('/publications/' + publication.id, other, 404);
    await patch({ body: { revision: 2, aiScript: 'Mudança durante agendamento' }, status: 409 });
    assert.equal(publication.status, 'SCHEDULED');
    await poll(() => get('/publications/' + publication.id, token), value => !!value.containerId);
    // Let the next BullMQ reconciliation recover the stored publication without waiting a minute.
    await db.publication.update({ where: { id: publication.id }, data: { nextAttemptAt: new Date() } });
    const published = await poll(() => get('/publications/' + publication.id, token), value => value.status === 'PUBLISHED');
    assert.equal(published.externalId, 'test-reel');
    assert.equal(published.schedule.status, 'APPROVED');
    assert.equal(publishes, 1);
    await patch({ body: { revision: 2, aiScript: 'Nova revisão depois de publicar' } });
    await post('/publications', token, {
      contentId: content.id, videoId: render.video.id, socialAccountId: account.id, date: new Date(Date.now() + 60_000).toISOString(),
    }, 409);
  } finally {
    if (companies.length) {
      await db.company.deleteMany({ where: { id: { in: companies } } }).finally(() => app.close());
    } else {
      await app.close();
    }
  }
});
