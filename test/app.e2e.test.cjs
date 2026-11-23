const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Readable } = require('node:stream');
const { setTimeout: delay } = require('node:timers/promises');
const { test } = require('node:test');
const { ValidationPipe } = require('@nestjs/common');
const { Test } = require('@nestjs/testing');
const sharp = require('sharp');
const { Webhook } = require('standardwebhooks');

test('company onboarding through content preparation and deferred publication creation', { timeout: 70_000 }, async () => {
  assert.ok(process.env.TEST_DATABASE_URL, 'Configure TEST_DATABASE_URL with a dedicated test instance.');
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.OPENAI_MODEL = 'test-model';
  process.env.OPENAI_WEBHOOK_SECRET = 'whsec_' + Buffer.from(randomUUID()).toString('base64');
  process.env.CREATOMATE_WEBHOOK_SECRET = randomUUID();
  process.env.REPLICATE_WEBHOOK_SECRET = 'whsec_' + Buffer.from(randomUUID()).toString('base64');
  process.env.VIDEO_PROVIDER = 'creatomate';
  process.env.VIDEO_REVIEW_ENABLED = 'true';
  process.env.JWT_SECRET = randomUUID() + randomUUID();
  process.env.SOCIAL_CREDENTIAL_KEY = Buffer.alloc(32, 42).toString('base64');
  process.env.INSTAGRAM_APP_ID = 'test-app';
  process.env.INSTAGRAM_APP_SECRET = 'test-secret';
  process.env.INSTAGRAM_GRAPH_VERSION = 'v27.0';
  process.env.NODE_ENV = 'test';
  process.env.SERVICE_BASE_URL = 'http://127.0.0.1';
  const { AppModule } = require('../dist/app.module');
  const { PrismaService } = require('../dist/prisma/prisma.service');
  const { AppErrorFilter } = require('../dist/shared/core/errors/app-error.filter');
  const { ExternalApiProvider } = require('../dist/shared/libs/http/external-api.provider');
  const { StorageProvider } = require('../dist/shared/libs/storage/storage.provider');
  const { VideoProvider } = require('../dist/modules/video-generation/domain/providers/video.provider');
  const { VideoReviewProvider } = require('../dist/modules/video-generation/domain/providers/video-review.provider');

  const { VideoTranscriptionProvider } = require('../dist/modules/video-generation/domain/providers/video-transcription.provider');
  const { VideoSubtitlesProvider } = require('../dist/modules/video-generation/domain/providers/video-subtitles.provider');
  const srt = '1\n00:00:00,200 --> 00:00:02,500\nTexto do vídeo.\n';
  const transcriptionRequests = [];
  const objects = new Map();
  let publishes = 0;
  let renders = 0;
  let failRender = false;
  let reviews = 0;
  let signalReviewStarted;
  let releaseReview;
  const reviewStarted = new Promise(resolve => {
    signalReviewStarted = resolve;
  });
  const reviewGate = new Promise(resolve => {
    releaseReview = resolve;
  });
  let scripts = 0;
  let scriptRequests = 0;
  const expectedScriptBrief = {
    brand: 'Marca A', objective: null, guidelines: 'Usar fotos reais.',
    products: ['Produto A', 'Produto complementar'],
  };
  const scriptResponses = new Map();
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(StorageProvider).useValue({
      put: async (key, body) => {
        const chunks = [];
        for await (const chunk of Buffer.isBuffer(body) ? [body] : body) chunks.push(chunk);
        objects.set(key, Buffer.concat(chunks));
      },

      open: async key => Readable.from([objects.get(key)]),

      url: async key => 'https://storage.invalid/' + key,

      remove: async key => {
        objects.delete(key);
      },
    })
    .overrideProvider(VideoProvider).useValue({
      render: async input => {
        renders++;
        assert.equal(input.script, failRender ? 'Nova revisão depois de publicar' : 'Roteiro criado pela IA.');
        assert.equal(input.imageUrls.length, 1);

        if (failRender) throw new Error('Render indisponível no teste.');

        return randomUUID();
      },

      download: async () => Readable.from([Buffer.from('test mp4')]),
    })
    .overrideProvider(VideoReviewProvider).useValue({
      review: async (video, render, references) => {
        reviews++;
        signalReviewStarted();
        await reviewGate;
        const chunks = [];
        for await (const chunk of video) chunks.push(chunk);
        assert.equal(Buffer.concat(chunks).toString(), 'test mp4');
        assert.equal(render.brief.brand, 'Marca A');
        assert.equal(references.length, 1);
        return { status: 'APPROVED', reason: 'Produtos conferem.', ocr: [] };
      },
    })
    .overrideProvider(VideoTranscriptionProvider).useValue({
      transcribe: async (submissionId, videoUrl) => {
        assert.match(videoUrl, /^https:\/\/storage\.invalid\/.*\.mp4$/);
        transcriptionRequests.push(submissionId);
      },
    })
    .overrideProvider(VideoSubtitlesProvider).useValue({
      burn: async (videoKey, subtitles) => {
        assert.equal(subtitles, srt);
        assert.ok(objects.has(videoKey));
        return videoKey.replace(/\.mp4$/, '.captioned.mp4');
      },
    })
    .overrideProvider(ExternalApiProvider).useValue({
      json: async (address, request) => {
        const url = new URL(address);

        if (url.hostname === 'api.openai.com') {
          assert.equal(request.headers.Authorization, 'Bearer test-key');

          if (url.pathname === '/v1/chat/completions') {
            const { messages } = JSON.parse(request.body);
            assert.deepEqual(JSON.parse(messages[1].content), expectedScriptBrief);
            scripts++;
            return { choices: [{ message: { content: 'Roteiro criado pela IA.' } }] };
          }

          if (url.pathname === '/v1/responses' && request.method === 'POST') {
            const payload = JSON.parse(request.body);
            assert.equal(payload.background, true);
            assert.equal(payload.store, true);
            assert.deepEqual(JSON.parse(payload.input), expectedScriptBrief);
            const id = 'resp_' + ++scriptRequests;
            const response = { id, metadata: payload.metadata, status: 'queued' };
            scriptResponses.set(id, response);
            return response;
          }

          const response = scriptResponses.get(url.pathname.split('/').pop());
          assert.ok(response, 'Resposta de roteiro desconhecida.');
          return response;
        }

        if (url.hostname === 'api.instagram.com') {
          assert.equal(request.body.get('code'), 'accepted-code');
          assert.equal(request.body.get('redirect_uri'), 'http://127.0.0.1/social-accounts/instagram/callback');
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

  const app = module.createNestApplication({ rawBody: true });
  const db = app.get(PrismaService);
  const companies = [];
  try {
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new AppErrorFilter());
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl();

    async function request (route, { method = 'GET', token, body, cookie, status = 200, headers = {} } = {}) {
      headers = { ...headers };

      if (token) headers.Authorization = 'Bearer ' + token;

      if (cookie) headers.Cookie = cookie;

      if (body && !(body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(body);
      }

      const response = await fetch(base + route, { method, headers, body });
      const responseBody = await response.text();
      const data = responseBody ? JSON.parse(responseBody) : undefined;
      assert.equal(response.status, status, method + ' ' + route + ' ' + JSON.stringify(data));
      return { data, cookie: response.headers.get('set-cookie')?.split(';')[0] };
    }

    const post = async (route, token, body, status = 201) => (await request(route, { method: 'POST', token, body, status })).data;

    const get = async (route, token, status = 200) => (await request(route, { token, status })).data;

    const deliverScriptWebhook = (body, valid = true) =>
      deliverSignedWebhook('/webhooks/openai', process.env.OPENAI_WEBHOOK_SECRET, body, valid);

    function deliverSignedWebhook (route, secret, body, valid = true) {
      const webhookId = 'msg_' + randomUUID();
      const timestamp = new Date();
      const webhook = new Webhook(secret);
      const signature = webhook.sign(webhookId, timestamp, JSON.stringify(body));

      return request(route, {
        method: 'POST', body, status: valid ? 204 : 401,
        headers: {
          'webhook-id': webhookId,
          'webhook-timestamp': String(Math.floor(timestamp.getTime() / 1000)),
          'webhook-signature': valid ? signature : 'v1,invalid',
        },
      });
    }

    async function poll (read, done) {
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
    const product = await post('/products', token, { brandId: brand.id, name: 'Produto A' });
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

    const patch = ({ body, ...options }) => request('/contents/' + content.id, {
      method: 'PATCH', token, body: { campaingId: campaign.id, ...body }, ...options,
    });

    const changed = await patch({ body: { revision: 1, aiScript: 'Roteiro revisado.' } });
    assert.equal(changed.data.revision, 2);
    await patch({ body: { revision: 1, aiScript: 'Obsoleto' }, status: 409 });
    const history = await get('/contents/' + content.id + '/history', token);
    assert.deepEqual(history.map(item => item.revision), [2, 1]);
    assert.equal(history[1].snapshot.aiScript, 'Roteiro criado pela IA.');

    const { data: connection, cookie } = await request('/social-accounts/instagram/connect', { method: 'POST', token, status: 201 });
    assert.ok(cookie);
    const authorization = new URL(connection.authorizationUrl);
    assert.equal(authorization.searchParams.get('redirect_uri'), 'http://127.0.0.1/social-accounts/instagram/callback');
    const state = authorization.searchParams.get('state');
    const callback = '/social-accounts/instagram/callback?code=accepted-code&state=' + state;
    await get(callback, undefined, 400);
    const { data: account } = await request(callback, { cookie });
    assert.equal(account.accountHandle, 'test_business');
    await request(callback, { cookie, status: 400 });
    assert.deepEqual(await get('/social-accounts', other), []);
    const credential = await db.socialCredential.findFirstOrThrow({ where: { socialAccountId: account.id } });
    assert.notEqual(credential.encryptedValue, 'instagram-long-token');
    assert.equal(account.encryptedValue, undefined);

    await db.content.update({ where: { id: content.id }, data: { aiScript: '', scriptStatus: 'NOT_STARTED' } });
    const preparePath = '/publications/contents/' + content.id + '/prepare';
    await post(preparePath, other, undefined, 404);
    const processing = await post(preparePath, token, undefined, 202);
    assert.deepEqual(processing, { contentId: content.id, revision: 2, status: 'PENDING' });
    assert.equal(await db.contentScheduled.count({ where: { contentId: content.id } }), 0);
    assert.equal(await db.publication.count({ where: { companyId: a.companyId } }), 0);

    const scheduledAt = new Date(Date.now() + 10 * 60_000);
    const schedule = await post('/publications', token, {
      contentId: content.id, socialAccountId: account.id, date: scheduledAt.toISOString(),
    });
    const schedulePath = '/publications/schedules/' + schedule.id;
    assert.equal(schedule.status, 'WAITING');
    assert.equal(schedule.publication, null);
    assert.equal(schedule.videoId, null);
    assert.equal(new Date(schedule.date).getTime(), scheduledAt.getTime());
    await get(schedulePath, other, 404);
    await patch({ body: { revision: 2, aiScript: 'Mudança durante agendamento' }, status: 409 });

    const awaitingScript = await poll(
      () => db.videoGeneration.findFirst({ where: { contentId: content.id, revision: 2 } }),
      value => value?.status === 'SCRIPT_GENERATING',
    );
    assert.equal(scripts, 1);
    assert.equal(scriptRequests, 1);
    assert.equal(renders, 0);
    const writing = await get('/contents/' + content.id, token);
    assert.equal(writing.aiScript, '');
    assert.equal(writing.scriptStatus, 'PENDING');
    assert.equal(writing.videoStatus, 'NOT_STARTED');

    const response = scriptResponses.get('resp_1');
    assert.equal(response.metadata.script_submission_id, awaitingScript.scriptSubmissionId);
    response.status = 'completed';
    response.output = [
      { type: 'message', content: [{ type: 'output_text', text: 'Roteiro criado pela IA.' }] },
    ];
    const scriptEvent = { type: 'response.completed', data: { id: response.id } };
    await deliverScriptWebhook(scriptEvent, false);
    assert.equal((await get('/video-generations/' + awaitingScript.id, token)).status, 'SCRIPT_GENERATING');
    await deliverScriptWebhook(scriptEvent);
    await deliverScriptWebhook(scriptEvent);

    const generation = await poll(
      () => db.videoGeneration.findFirst({ where: { contentId: content.id, revision: 2 } }),
      value => value?.status === 'RENDERING',
    );
    assert.equal(scripts, 1);
    assert.equal(scriptRequests, 1);
    assert.equal(renders, 1);
    const rendering = await get('/contents/' + content.id, token);
    assert.equal(rendering.aiScript, 'Roteiro criado pela IA.');
    assert.equal(rendering.scriptStatus, 'READY');
    assert.equal(rendering.videoStatus, 'PENDING');
    await get('/video-generations/' + generation.id, other, 404);
    const renderWebhookBody = {
      id: generation.providerId, metadata: generation.submissionId, status: 'succeeded', url: 'https://cdn.invalid/render.mp4',
    };
    await post('/webhooks/creatomate?token=invalid', undefined, renderWebhookBody, 401);
    assert.equal((await get('/video-generations/' + generation.id, token)).status, 'RENDERING');

    const webhook = '/webhooks/creatomate?token=' + process.env.CREATOMATE_WEBHOOK_SECRET;
    const completion = post(webhook, undefined, renderWebhookBody, 204);
    try {
      await Promise.race([reviewStarted, completion.then(() => assert.fail('O webhook deve aguardar a revisão.'))]);
      await post(webhook, undefined, renderWebhookBody, 503);
    } finally {
      releaseReview();
      await completion;
    }
    await post(webhook, undefined, renderWebhookBody, 204);
    assert.equal(reviews, 1);
    const render = await poll(() => get('/video-generations/' + generation.id, token), value => value.status === 'READY');
    assert.equal(render.video.review.status, 'APPROVED');
    const prepared = await get('/contents/' + content.id, token);
    assert.equal(prepared.status, 'READY');
    assert.equal(prepared.scriptStatus, 'READY');
    assert.equal(prepared.videoStatus, 'READY');

    const submission = await poll(() => transcriptionRequests[0], Boolean);
    assert.equal((await get(schedulePath, token)).publication, null);
    assert.equal(await db.publication.count({ where: { companyId: a.companyId } }), 0);
    const transcriptionWebhook = '/webhooks/replicate/transcription?submissionId=' + submission;
    await deliverSignedWebhook(transcriptionWebhook, process.env.REPLICATE_WEBHOOK_SECRET, {
      id: 'whisper-test', status: 'succeeded', output: { transcription: srt },
    });

    const ready = await poll(() => get(schedulePath, token), value => !!value.publication);
    assert.equal(ready.videoId, render.video.id);
    assert.equal(ready.publication.status, 'SCHEDULED');
    assert.equal(ready.status, 'READY');
    const publication = await get('/publications/' + ready.publication.id, token);
    assert.equal(publication.caption, 'Legenda de catálogo');
    assert.equal(publication.schedule.id, schedule.id);
    assert.equal((await get('/contents/' + content.id, token)).subtitleStatus, 'READY');
    assert.equal(await db.publication.count({ where: { companyId: a.companyId } }), 1);
    await post(preparePath, token, undefined, 202);
    assert.equal(await db.publication.count({ where: { companyId: a.companyId } }), 1);
    assert.equal(publishes, 0);
    await db.publication.update({ where: { id: publication.id }, data: { status: 'PUBLISHED' } });
    await patch({ body: { revision: 2, aiScript: 'Nova revisão depois de publicar' } });
    await post('/publications', token, {
      contentId: content.id, videoId: render.video.id, socialAccountId: account.id, date: new Date(Date.now() + 60_000).toISOString(),
    }, 409);

    await deliverScriptWebhook(scriptEvent);
    await post(webhook, undefined, renderWebhookBody, 204);
    const revised = await get('/contents/' + content.id, token);
    assert.equal(revised.aiScript, 'Nova revisão depois de publicar');
    assert.equal(revised.scriptStatus, 'READY');
    assert.equal(revised.videoStatus, 'NOT_STARTED');

    failRender = true;
    const pendingPublication = await post('/publications', token, {
      contentId: content.id, socialAccountId: account.id, date: new Date(Date.now() + 60_000).toISOString(),
    });
    const failedPublication = await poll(
      () => get('/publications/schedules/' + pendingPublication.id, token), value => value.status === 'ERROR',
    );
    assert.match(failedPublication.preparationError, /render|vídeo/i);
    assert.equal(failedPublication.publication, null);
    const videoFailure = await get('/contents/' + content.id, token);
    assert.equal(videoFailure.scriptStatus, 'READY');
    assert.equal(videoFailure.videoStatus, 'FAILED');
    assert.equal(renders, 2);
    assert.equal(scripts, 1);
    assert.equal(scriptRequests, 1);

    await patch({ body: { revision: 3, aiScript: 'Roteiro da revisão seguinte.' } });
    await db.content.update({ where: { id: content.id }, data: { aiScript: '', scriptStatus: 'NOT_STARTED' } });
    const scriptFailurePublication = await post('/publications', token, {
      contentId: content.id, socialAccountId: account.id, date: new Date(Date.now() + 60_000).toISOString(),
    });
    const failedScriptGeneration = await poll(
      () => db.videoGeneration.findFirst({ where: { contentId: content.id, revision: 4 } }),
      value => value?.status === 'SCRIPT_GENERATING',
    );
    const failedResponse = scriptResponses.get('resp_2');
    assert.equal(failedResponse.metadata.script_submission_id, failedScriptGeneration.scriptSubmissionId);
    failedResponse.status = 'failed';
    await deliverScriptWebhook({ type: 'response.failed', data: { id: failedResponse.id } });
    const rejected = await poll(
      () => get('/publications/schedules/' + scriptFailurePublication.id, token), value => value.status === 'ERROR',
    );
    assert.match(rejected.preparationError, /roteiro/);
    assert.equal(rejected.publication, null);
    const scriptFailure = await get('/contents/' + content.id, token);
    assert.equal(scriptFailure.scriptStatus, 'FAILED');
    assert.equal(scriptFailure.videoStatus, 'NOT_STARTED');
    assert.equal(renders, 2);
    assert.equal(publishes, 0);
  } finally {
    if (companies.length) {
      await db.company.deleteMany({ where: { id: { in: companies } } }).finally(() => app.close());
    } else {
      await app.close();
    }
  }
});

test('publication repository waits for preparation and claims one worker at a time', async () => {
  const { PrismaService }= require('../dist/prisma/prisma.service');
  const { RequestContext } = require('../dist/shared/core/request-context/request-context');
  const { PrismaPublicationRepository } = require('../dist/modules/publication/infra/prisma/publication.prisma-repository');
  const { CLAIM_LEASE_MS } = require('../dist/modules/publication/domain/entities/publication-timing');
  assert.ok(process.env.TEST_DATABASE_URL, 'Configure TEST_DATABASE_URL with a dedicated test instance.');
  const db = new PrismaService({ datasourceUrl: process.env.TEST_DATABASE_URL });
  const repository = new PrismaPublicationRepository(db, new RequestContext());
  const { PrismaContentScheduleRepository } = require('../dist/modules/publication/infra/prisma/prisma-content-schedule-repository');
  const { PrismaContentPreparationRepository } = require('../dist/modules/content/infra/prisma/prisma-content-preparation-repository');
  const schedules = new PrismaContentScheduleRepository(db, new RequestContext());
  const preparation = new PrismaContentPreparationRepository(db);
  const eligibleSchedules = async () => (await schedules.findEligibleContents()).map(({ companyId, contentId }) => ({ companyId, contentId }));
  let companyId;

  try {
    ({ id: companyId } = await db.company.create({ data: { name: 'Publication lease test' } }));
    const brand = await db.brand.create({ data: { companyId, name: 'Marca' } });
    const campaign = await db.campaign.create({ data: { companyId, brandId: brand.id, name: 'Campanha' } });
    const rules = await db.campaignRules.create({
      data: { companyId, campaingId: campaign.id, name: 'Regra', guidelines: 'Use fotos reais.' },
    });
    const product = await db.product.create({ data: { companyId, brandId: brand.id, name: 'Produto' } });
    const content = await db.content.create({
      data: { companyId, campaingId: campaign.id, campaingRulesId: rules.id, productId: product.id, aiScript: 'Roteiro.' },
    });
    const account = await db.socialAccount.create({
      data: { companyId, platform: 'INSTAGRAM', accountHandle: 'test', externalId: randomUUID() },
    });

    const start = Date.now();
    const schedule = await schedules.save({
      companyId, contentId: content.id, socialAccountId: account.id,
      date: new Date(start + 60_000),
    });
    const input = { companyId, contentId: content.id, revision: content.revision };
    const work = { companyId, contentId: content.id };
    assert.equal(schedule.publication, null);
    assert.deepEqual(await eligibleSchedules(), [work]);
    assert.deepEqual(await preparation.findEligibleContents(4), []);
    await preparation.request(work);
    assert.deepEqual((await preparation.findEligibleContents(4)).map(({ contentId }) => contentId), [content.id]);
    assert.deepEqual(await repository.findEligibleIds(), []);
    await db.content.update({ where: { id: content.id }, data: { scriptStatus: 'PENDING' } });
    assert.deepEqual(await eligibleSchedules(), []);
    await db.content.update({ where: { id: content.id }, data: { scriptStatus: 'READY', videoStatus: 'READY', status: 'READY' } });
    assert.deepEqual(await eligibleSchedules(), [work]);
    await db.contentScheduled.update({ where: { id: schedule.id }, data: { date: new Date(start - 1) } });
    const { PrismaVideoTranscriptionRepository } = require(
      '../dist/modules/video-generation/infra/prisma/video-transcription.prisma-repository'
    );
    const transcriptionRepository = new PrismaVideoTranscriptionRepository(db);
    const render = await db.videoGeneration.create({
      data: { ...input, input: {}, status: 'READY' },
    });
    const storageKey = companyId + '/test.mp4';
    await db.videoAsset.create({
      data: {
        ...input, generationId: render.id, storageKey, reviewStatus: 'APPROVED', review: {},
      },
    });
    const { TranscribeVideoUseCase } = require('../dist/modules/video-generation/application/use-cases/transcribe-video.usecase');
    const { ReplicateWhisperProvider } = require('../dist/modules/video-generation/infra/providers/replicate-whisper.provider');
    const { ReplicateWebhookController } = require('../dist/modules/video-generation/infra/controllers/replicate-webhook.controller');
    process.env.SERVICE_BASE_URL = 'https://service.invalid';
    process.env.REPLICATE_API_TOKEN = 'test-replicate-token';
    process.env.REPLICATE_WEBHOOK_SECRET = 'whsec_' + Buffer.from(randomUUID()).toString('base64');

    const videoUrl = 'https://storage.invalid/' + storageKey;
    const requests = [];
    const provider = new ReplicateWhisperProvider({
      json: async (url, request) => {
        assert.equal(url, 'https://api.replicate.com/v1/predictions');
        assert.equal(request.method, 'POST');
        assert.equal(request.headers.Authorization, 'Bearer test-replicate-token');
        const body = JSON.parse(request.body);
        assert.match(body.version, /^openai\/whisper:[a-f0-9]{64}$/);
        assert.deepEqual(body.input, { audio: videoUrl, language: 'pt', translate: false, transcription: 'srt' });
        assert.deepEqual(body.webhook_events_filter, ['completed']);
        requests.push(new URL(body.webhook));
        return { id: 'whisper-test', status: 'starting' };
      },
    });
    const transcribe = new TranscribeVideoUseCase(transcriptionRepository, provider, {
      url: async key => {
        assert.equal(key, storageKey);
        return videoUrl;
      },
    });
    await Promise.all([transcribe.execute(input), transcribe.execute(input)]);
    assert.equal(requests.length, 1);
    const [webhook] = requests;
    assert.equal(webhook.pathname, '/webhooks/replicate/transcription');
    assert.deepEqual(await eligibleSchedules(), []);
    assert.deepEqual(await repository.findEligibleIds(), []);
    const controller = new ReplicateWebhookController(null, null, transcribe);
    const submissionId = webhook.searchParams.get('submissionId');
    const send = (body, valid = true) => {
      const rawBody = Buffer.from(JSON.stringify(body));
      const webhookId = randomUUID();
      const timestamp = new Date();
      const signer = new Webhook(process.env.REPLICATE_WEBHOOK_SECRET);
      const signature = signer.sign(webhookId, timestamp, rawBody);
      const headers = {
        'webhook-id': webhookId,
        'webhook-timestamp': String(Math.floor(timestamp.getTime() / 1000)),
        'webhook-signature': valid ? signature : 'v1,invalid',
      };
      return controller.receiveTranscription({ rawBody, header: name => headers[name] }, submissionId);
    };
    const srt = '1\n00:00:00,200 --> 00:00:02,500\nTexto do vídeo.\n';
    const result = { id: 'whisper-test', status: 'succeeded', output: { transcription: srt } };
    await assert.rejects(send(result, false), { status: 401 });
    await send(result);
    await send({ id: result.id, status: 'failed' });
    const transcribed = await db.content.findUniqueOrThrow({ where: { id: content.id } });
    assert.equal(transcribed.transcription, 'Texto do vídeo.');
    assert.equal(transcribed.transcriptionStatus, 'READY');
    assert.equal(transcribed.subtitleSrt, srt);
    assert.deepEqual(await repository.findEligibleIds(), []);

    const { PrismaVideoSubtitlesRepository } = require('../dist/modules/video-generation/infra/prisma/video-subtitles.prisma-repository');
    const { BurnVideoSubtitlesUseCase } = require('../dist/modules/video-generation/application/use-cases/burn-video-subtitles.usecase');
    const subtitlesRepository = new PrismaVideoSubtitlesRepository(db);
    const captionedStorageKey = companyId + '/test.captioned.mp4';
    let burns = 0;
    const burn = new BurnVideoSubtitlesUseCase(subtitlesRepository, {
      burn: async (key, subtitles) => {
        assert.equal(key, storageKey);
        assert.equal(subtitles, srt);
        burns++;
        return captionedStorageKey;
      },
    });
    await Promise.all([burn.execute(input), burn.execute(input)]);
    assert.equal(burns, 1);
    const captioned = await db.videoAsset.findFirstOrThrow({ where: { generationId: render.id } });
    assert.equal(captioned.captionedStorageKey, captionedStorageKey);
    assert.deepEqual(await eligibleSchedules(), [work]);
    const prepared = { ...work, revision: content.revision, videoId: captioned.id };
    await preparation.complete(work, content.revision);
    assert.deepEqual(await preparation.findEligibleContents(4), []);
    assert.equal(await db.publication.count({ where: { companyId } }), 0);
    await Promise.all([repository.createFromPreparedContent(prepared), repository.createFromPreparedContent(prepared)]);
    const [{ id: publicationId }] = await repository.findEligibleIds();
    assert.equal(await db.publication.count({ where: { companyId, scheduleId: schedule.id } }), 1);
    assert.deepEqual(await eligibleSchedules(), []);

    const claims = await Promise.all([repository.reserveForProcessing(publicationId), repository.reserveForProcessing(publicationId)]);
    assert.equal(claims.filter(Boolean).length, 1);
    const originalClaim = claims.find(Boolean);
    assert.ok(originalClaim.leaseUntil.getTime() >= start + CLAIM_LEASE_MS);
    assert.equal(await repository.reserveForProcessing(publicationId), null);
    await db.publication.update({ where: { id: publicationId }, data: { leaseUntil: new Date(start - 1) } });
    const reclaim = await repository.reserveForProcessing(publicationId);
    assert.ok(reclaim);
    await repository.releaseProcessing(originalClaim, 'stale-worker');
    const stillOwned = await db.publication.findUniqueOrThrow({ where: { id: publicationId } });
    assert.equal(stillOwned.containerId, null);
    assert.deepEqual(stillOwned.leaseUntil, reclaim.leaseUntil);
  } finally {
    try {
      if (companyId) await db.company.delete({ where: { id: companyId } });
    } finally {
      await db.$disconnect();
    }
  }
});
