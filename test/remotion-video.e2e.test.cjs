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

test('claude script + remotion: script in background, brand voice and colors, video ready for publication', { timeout: 90_000 }, async () => {
  assert.ok(process.env.TEST_DATABASE_URL, 'Configure TEST_DATABASE_URL with a dedicated test instance.');
  const port = await freePort();
  Object.assign(process.env, {
    DATABASE_URL: process.env.TEST_DATABASE_URL, JWT_SECRET: randomUUID() + randomUUID(), NODE_ENV: 'test', PORT: String(port),
    ANTHROPIC_API_KEY: 'test-key',
    INTERNAL_WEBHOOK_SECRET: 'whsec_' + Buffer.from(randomUUID()).toString('base64'),
    REMOTION_WEBHOOK_SECRET: 'whsec_' + Buffer.from(randomUUID()).toString('base64'),
  });
  const { AppModule } = require('../dist/app.module');
  const { PrismaService } = require('../dist/prisma/prisma.service');
  const { AppErrorFilter } = require('../dist/shared/core/errors/app-error.filter');
  const { StorageProvider } = require('../dist/shared/libs/storage/storage.provider');
  const { CopyWriterProvider } = require('../dist/modules/video-generation/domain/providers/copy-writer.provider');
  const { RemotionCliRenderer } = require('../dist/modules/video-generation/infra/remotion/remotion-cli.renderer');
  const { ClaudeScriptProvider } = require('../dist/modules/content/infra/providers/claude-script.provider');
  const { ScriptProvider } = require('../dist/modules/content/domain/providers/script.provider');
  const scenes = { hook: 'Corra mais leve', benefits: ['Amortecimento macio', 'Cabedal respirável'], callToAction: 'Garanta o seu' };
  const claudeCalls = [];

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
    // O app pode estar com o roteiro simulado (TESTE mock); este teste exercita sempre o provider do Claude.
    .overrideProvider(ScriptProvider).useFactory({ factory: claude => claude, inject: [ClaudeScriptProvider] })
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
    .compile();

  const app = module.createNestApplication({ rawBody: true });
  // Substitui só o cliente da API: o provider real roda o fluxo em background e o webhook interno.
  app.get(ClaudeScriptProvider).client = { beta: { messages: { parse: async params => {
    claudeCalls.push(params);
    return { stop_reason: 'end_turn', parsed_output: scenes };
  } } } };
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
      for (let attempt = 0; attempt < 120; attempt++) {
        const value = await read();
        if (done(value)) return value;
        await delay(250);
      }
      assert.fail('Expected state was not reached');
    }

    const signup = await post('/auth/signup', undefined, { companyName: 'Empresa Remotion', email: randomUUID() + '@example.com', password: 'sua-senha-de-teste' });
    companyId = signup.companyId;
    const token = signup.accessToken;
    const brand = await post('/brands', token, {
      name: 'Marca Run', primaryColor: '#FF5500', secondaryColor: '#1a1a1a', tertiaryColor: '#EC4899', quaternaryColor: '#fbcfe8',
      voiceTone: 'Enérgico e motivador', targetAudience: 'Corredores iniciantes', copyGuidelines: 'Destacar conforto; evitar jargão técnico.',
    });
    assert.equal(brand.primaryColor, '#ff5500', 'colors are stored in lowercase');
    assert.equal(brand.tertiaryColor, '#ec4899');
    assert.equal(brand.quaternaryColor, '#fbcfe8');
    assert.equal(brand.voiceTone, 'Enérgico e motivador');
    assert.deepEqual((await call('/brands/' + brand.id, { token })).copyGuidelines, 'Destacar conforto; evitar jargão técnico.');
    await post('/brands', token, { name: 'Cor inválida', primaryColor: 'laranja' }, 400);
    assert.equal((await post('/brands', token, { name: 'Sem perfil' })).primaryColor, null);
    const product = await post('/products', token, { brandId: brand.id, name: 'Tênis Run', description: 'Leve', price: 199.9, oldPrice: 249.9 });
    const campaign = await post('/campaigns', token, { brandId: brand.id, name: 'Lançamento' });
    const rules = await post('/campaign-rules', token, { campaingId: campaign.id, name: 'Regra', guidelines: 'Usar fotos reais.' });
    const file = new FormData();
    const image = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#224466' } }).png().toBuffer();
    file.set('file', new Blob([image], { type: 'image/png' }), 'reference.png');
    const asset = await post('/products/' + product.id + '/media', token, file);
    const content = await post('/contents', token, { campaingId: campaign.id, campaingRulesId: rules.id, productId: product.id, mediaAssetIds: [asset.id] });
    const formatted = 'Gancho: Corra mais leve\nBenefícios:\n- Amortecimento macio\n- Cabedal respirável\nChamada: Garanta o seu';
    assert.equal(content.aiScript, formatted, 'content creation writes the script with Claude');
    // Força o caminho assíncrono do orchestrator: roteiro em background avisado pelo webhook interno.
    await db.content.update({ where: { id: content.id }, data: { aiScript: '', scriptStatus: 'NOT_STARTED' } });

    const preparePath = '/publications/contents/' + content.id + '/prepare';
    assert.deepEqual(await post(preparePath, token, undefined, 202), { contentId: content.id, revision: 1, status: 'PENDING' });

    const prepared = await poll(() => call('/contents/' + content.id, { token }), value => value.videoStatus === 'READY');
    assert.equal(prepared.status, 'READY');
    assert.equal(prepared.transcriptionStatus, 'READY', 'video without speech skips transcription');
    assert.equal(prepared.subtitleStatus, 'READY');
    assert.equal(prepared.transcription, '');

    assert.equal(prepared.aiScript, formatted);
    assert.equal(claudeCalls.length, 2, 'one script on creation and one in background');
    assert.match(claudeCalls[1].messages[0].content, /"voiceTone":"Enérgico e motivador"[\s\S]*"targetAudience":"Corredores iniciantes"/);
    assert.deepEqual(briefs, [], 'the scene script becomes the copy without the copy writer');
    assert.equal(renders.length, 1);
    const { primaryColor, secondaryColor } = renders[0].props.brand;
    const brandColors = ['#ff5500', '#1a1a1a', '#ec4899', '#fbcfe8'];
    assert.ok(brandColors.includes(primaryColor) && brandColors.includes(secondaryColor) && primaryColor !== secondaryColor, 'two brand colors drawn for this render');
    assert.deepEqual(renders[0].props.copy.bullets, scenes.benefits);
    assert.match(renders[0].compositionId, /^ProductAd(Editorial|Kinetic)?-9x16$/, 'one of the registered templates, in the Reels format');
    assert.equal(renders[0].props.product.price, 'R$ 199,90');
    assert.equal(renders[0].props.product.oldPrice, 'R$ 249,90');
    assert.equal(renders[0].props.copy.headline, 'Corra mais leve');
    assert.match(renders[0].props.product.imageUrl, new RegExp(`^https://storage.invalid/${companyId}/products/${product.id}/`));

    const generation = await call('/contents/' + content.id + '/video-generations', { token });
    assert.equal(generation.status, 'READY');
    assert.equal(generation.video.review.status, 'APPROVED');
    assert.equal(generation.video.captionedUrl, null);
    const videoKey = [...objects.keys()].find(key => key.startsWith(`${companyId}/contents/${content.id}/videos/`));
    assert.match(videoKey, new RegExp(`/videos/\\d{5,}-ProductAd\\w*-${generation.id}\\.mp4$`), 'sequence number, template and generation id');
    assert.ok(generation.video.url.includes(videoKey));
    assert.equal(objects.get(videoKey).toString(), 'remotion mp4');
    await poll(async () => [...objects.keys()], keys => !keys.some(key => key.startsWith('remotion-renders/')));

    const ready = await post(preparePath, token, undefined, 202);
    assert.equal(ready.status, 'READY');
    assert.equal(ready.videoId, generation.video.id);
  } finally {
    if (companyId) await db.company.deleteMany({ where: { id: companyId } });
    await app.close();
  }
});
