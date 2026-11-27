const assert = require('node:assert/strict');
const { test } = require('node:test');
const { Logger } = require('@nestjs/common');
const { isPublicAddress, parsePublicUrl, publicOnlyLookup } = require('../dist/shared/libs/http/safe-fetch');
const { OnboardingSession } = require('../dist/modules/onboarding/domain/entities/onboarding-session.entity');
const { InstagramUnavailableError } = require('../dist/modules/onboarding/domain/providers/instagram-profile.provider');
const { RunOnboardingResearchUseCase, sanitize } = require('../dist/modules/onboarding/application/use-cases/run-onboarding-research.usecase');
const { CompleteOnboardingUseCase } = require('../dist/modules/onboarding/application/use-cases/complete-onboarding.usecase');
const { HtmlWebsiteScanner } = require('../dist/modules/onboarding/infra/providers/html-website-scanner');
const { MetaBusinessDiscoveryProvider } = require('../dist/modules/onboarding/infra/providers/meta-business-discovery.provider');
const { AppError } = require('../dist/shared/core/errors/app.error');

Logger.overrideLogger(false);

test('safe fetch only accepts public http(s) addresses', async () => {
  for (const address of ['127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.0.10', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fe80::1', 'fd00::1', '::ffff:10.0.0.1']) {
    assert.equal(isPublicAddress(address), false, address);
  }
  assert.equal(isPublicAddress('8.8.8.8'), true);
  assert.equal(isPublicAddress('2606:4700:4700::1111'), true);

  assert.equal(parsePublicUrl('https://www.sauberglas.com.br/sobre#time').toString(), 'https://www.sauberglas.com.br/sobre');
  for (const url of ['ftp://site.com', 'file:///etc/passwd', 'http://localhost', 'http://127.0.0.1', 'http://[::1]/', 'http://intranet', 'http://app.internal', 'https://site.com:8443', 'https://user:pass@site.com', 'http://169.254.169.254/latest/meta-data']) {
    assert.throws(() => parsePublicUrl(url), error => error instanceof AppError && error.kind === 'invalid', url);
  }

  // A checagem também vale na conexão, sobre o IP resolvido (localhost resolve para 127.0.0.1).
  const error = await new Promise(resolve => publicOnlyLookup('localhost', {}, error => resolve(error)));
  assert.equal(error?.code, 'EBLOCKED');
});

test('onboarding normalizes the @ and the website typed by the user, and needs at least one of them', () => {
  assert.equal(OnboardingSession.normalizeHandle('@SauberGlas'), 'sauberglas');
  assert.equal(OnboardingSession.normalizeHandle('https://www.instagram.com/fabrica_donalu/?hl=pt'), 'fabrica_donalu');
  assert.equal(OnboardingSession.normalizeHandle('  '), null);
  assert.throws(() => OnboardingSession.normalizeHandle('@nome com espaço'), /@ do Instagram válido/);
  assert.equal(OnboardingSession.normalizeWebsite('www.sauberglas.com.br'), 'https://www.sauberglas.com.br/');
  assert.throws(() => OnboardingSession.normalizeWebsite('javascript:alert(1)'), /site válido/);
  assert.throws(() => OnboardingSession.validateInput(null, null), /site ou o @/);
});

const page = (body, head = '') => `<html><head>${head}</head><body>${body}</body></html>`;

test('the website scanner reads the home page, the relevant internal pages and the structured signals', async () => {
  const scanner = new HtmlWebsiteScanner();
  const pages = {
    'https://www.vidros.com.br/': page(
      '<header><img class="site-logo" src="/img/logo.png" alt="Logo"><link rel="icon" href="/favicon.ico"><link rel="icon" href="/favicon-32.png"><link rel="apple-touch-icon" href="/apple-icon.png"></header><nav><a href="/sobre">Quem somos</a><a href="/servicos">Serviços</a><a href="https://outro.com/sobre">fora</a><a href="/blog/post-1">Blog</a></nav>' +
      '<h1>Vidros &amp; Fachadas</h1><p>Limpeza de vidros em Itajaí.</p><a href="https://instagram.com/vidrosbr">Instagram</a><a href="https://www.instagram.com/p/abc">post</a><a href="https://wa.me/5547999990000">WhatsApp</a><a href="tel:+55 47 3333-0000">Ligue</a>' +
      '<script>var segredo = 1;</script><div style="color:#0b3a82">x</div>',
      '<title>Vidros BR</title><meta name="description" content="Limpeza de vidros"><meta property="og:site_name" content="Vidros BR"><meta name="theme-color" content="#0B3A82">' +
      '<link rel="stylesheet" href="/style.css"><script type="application/ld+json">{"@type":"LocalBusiness","name":"Vidros BR","logo":{"url":"https://www.vidros.com.br/ld-logo.png"}}</script>',
    ),
    'https://www.vidros.com.br/sobre': page('<p>Somos uma empresa familiar desde 2010.</p>'),
    'https://www.vidros.com.br/servicos': page('<ul><li>Limpeza de fachadas</li><li>Vitrines</li></ul>'),
    'https://www.vidros.com.br/style.css': '.a{color:#5dade2}.b{color:#5dade2}.c{background:#ffffff}.d{color:#0b3a82}',
  };
  const requested = [];
  scanner.fetch = async (url) => {
    requested.push(String(url));
    const body = pages[String(url)];
    if (body === undefined) throw new AppError('upstream', 'não encontrado');
    return { url: String(url), contentType: 'text/html', body: Buffer.from(body) };
  };

  const snapshot = await scanner.scan('https://www.vidros.com.br/');
  assert.deepEqual(snapshot.pages.map(page => page.url), ['https://www.vidros.com.br/', 'https://www.vidros.com.br/sobre', 'https://www.vidros.com.br/servicos'], 'only same-site relevant pages');
  assert.equal(requested.includes('https://outro.com/sobre'), false);
  assert.equal(snapshot.siteName, 'Vidros BR');
  assert.match(snapshot.pages[0].text, /Vidros & Fachadas/);
  assert.equal(snapshot.pages[0].text.includes('segredo'), false, 'scripts are not text');
  assert.equal(snapshot.themeColor, '#0b3a82');
  assert.deepEqual(snapshot.cssColors.slice(0, 2).sort(), ['#0b3a82', '#5dade2'], 'brand colors, without white');
  assert.deepEqual(snapshot.logoCandidates.slice(0, 2), ['https://www.vidros.com.br/ld-logo.png', 'https://www.vidros.com.br/img/logo.png'], 'JSON-LD logo first');
  assert.deepEqual(snapshot.logoCandidates.slice(2, 4), ['https://www.vidros.com.br/apple-icon.png', 'https://www.vidros.com.br/favicon-32.png'], 'the large apple-touch-icon before small favicons, without .ico');
  assert.deepEqual(snapshot.instagramHandles, ['vidrosbr'], 'post links are not profiles');
  assert.deepEqual(snapshot.whatsapp, ['5547999990000']);
  assert.deepEqual(snapshot.phones, ['+55 47 3333-0000']);
  assert.equal(snapshot.structuredData[0].name, 'Vidros BR');
});

const findings = {
  company: { name: 'Vidros BR', segment: 'Limpeza', description: null, serviceArea: 'Itajaí', phone: null, website: null, instagramHandle: null },
  brand: { name: 'Vidros BR', primaryColor: '#0B3A82', secondaryColor: 'azul', tertiaryColor: null, quaternaryColor: null, voiceTone: 'Próximo', targetAudience: null, copyGuidelines: null },
  products: [{ name: 'Fachadas', description: null }], otherBrands: [], logoUrl: 'https://inventado.com/logo.png', sources: { 'company.name': 'website' },
};

test('the research keeps the typed site and @, valid colors only and a logo found in the sources', () => {
  const website = { url: 'https://www.vidros.com.br/', logoCandidates: ['https://www.vidros.com.br/logo.png'] };
  const result = sanitize(findings, { website, instagram: null, websiteUrl: website.url, handle: 'vidrosbr', warnings: ['aviso'] });
  assert.equal(result.company.website, 'https://www.vidros.com.br/');
  assert.equal(result.company.instagramHandle, 'vidrosbr');
  assert.equal(result.brand.primaryColor, '#0b3a82');
  assert.equal(result.brand.secondaryColor, null, 'not a hex color');
  assert.equal(result.logoUrl, 'https://www.vidros.com.br/logo.png', 'an invented logo URL is replaced by a real candidate');
  assert.deepEqual(result.warnings, ['aviso']);
  const unnamed = sanitize({ ...findings, company: { ...findings.company, name: null } }, { website: { ...website, siteName: null }, instagram: null, websiteUrl: website.url, handle: null, warnings: [] });
  assert.equal(unnamed.company.name, 'Vidros BR', 'a missing company name falls back to the brand name');
});

function research ({ website, instagram, extract, attempts = 1 }) {
  const effects = [];
  const session = { id: 'session', websiteUrl: 'https://www.vidros.com.br/', instagramHandle: null, attempts };
  const sessions = {
    claimNext: async () => session,
    setStage: async (_, stage) => effects.push(['stage', stage]),
    markReady: async (_, value) => effects.push(['ready', value]),
    markFailed: async (_, error) => effects.push(['failed', error]),
    release: async () => effects.push(['release']),
  };
  const useCase = new RunOnboardingResearchUseCase(sessions, { scan: website }, { find: instagram }, { extract: extract ?? (async () => findings) });
  return { useCase, effects };
}

test('the research continues with the website when Instagram is unavailable, using the @ linked on the site', async () => {
  const handles = [];
  const { useCase, effects } = research({
    website: async () => ({ url: 'https://www.vidros.com.br/', logoCandidates: [], instagramHandles: ['vidrosbr'] }),
    instagram: async handle => { handles.push(handle); throw new InstagramUnavailableError('O app da Meta ainda não tem permissão.'); },
  });
  await useCase.runNext();
  assert.deepEqual(handles, ['vidrosbr']);
  assert.deepEqual(effects.map(([kind, value]) => kind === 'stage' ? value : kind), ['WEBSITE', 'INSTAGRAM', 'ANALYSIS', 'ready']);
  assert.deepEqual(effects.at(-1)[1].warnings, ['O app da Meta ainda não tem permissão.']);
});

test('the research fails when nothing can be read, and retries a failed analysis once before failing', async () => {
  const nothing = research({ website: async () => { throw new AppError('upstream', 'O site demorou demais para responder.'); }, instagram: async () => null });
  await nothing.useCase.runNext();
  assert.equal(nothing.effects.at(-1)[0], 'failed');
  assert.match(nothing.effects.at(-1)[1], /Não conseguimos ler o site nem o Instagram.*demorou demais/);

  const website = async () => ({ url: 'https://www.vidros.com.br/', logoCandidates: [], instagramHandles: [] });
  const extract = async () => { throw new AppError('upstream', 'A análise do negócio falhou. Tente novamente.'); };
  const first = research({ website, instagram: async () => null, extract, attempts: 1 });
  await first.useCase.runNext();
  assert.deepEqual(first.effects.at(-1), ['release']);
  const last = research({ website, instagram: async () => null, extract, attempts: 2 });
  await last.useCase.runNext();
  assert.deepEqual(last.effects.at(-1), ['failed', 'A análise do negócio falhou. Tente novamente.']);
});

test('Business Discovery reads a professional profile and explains when the Meta app lacks permission', async () => {
  const config = values => ({ get: key => values[key] });
  await assert.rejects(new MetaBusinessDiscoveryProvider(config({})).find('vidrosbr'), error => error instanceof InstagramUnavailableError && /não está configurada/.test(error.message));

  const provider = new MetaBusinessDiscoveryProvider(config({ INSTAGRAM_DISCOVERY_ACCOUNT_ID: '178', INSTAGRAM_DISCOVERY_TOKEN: 'token' }));
  const original = global.fetch;
  const calls = [];
  try {
    global.fetch = async (url, init) => { calls.push({ url: String(url), init }); return Response.json({ business_discovery: { username: 'vidrosbr', name: 'Vidros BR', biography: 'Limpeza', followers_count: 10, media: { data: [{ caption: 'Antes e depois' }, {}] } } }); };
    const profile = await provider.find('vidrosbr');
    assert.match(decodeURIComponent(calls[0].url), /graph\.facebook\.com\/v27\.0\/178\?fields=business_discovery\.username\(vidrosbr\)/);
    assert.equal(calls[0].url.includes('token'), false, 'the token goes in the header, not in the URL');
    assert.deepEqual({ name: profile.name, captions: profile.captions }, { name: 'Vidros BR', captions: ['Antes e depois'] });

    global.fetch = async () => Response.json({ error: { code: 10, message: 'Application does not have permission for this action' } }, { status: 400 });
    await assert.rejects(provider.find('vidrosbr'), error => error instanceof InstagramUnavailableError && /permissão/.test(error.message));

    global.fetch = async () => Response.json({ error: { code: 110, error_subcode: 2207013 } }, { status: 400 });
    assert.equal(await provider.find('contapessoal'), null, 'personal or missing account');
  } finally {
    global.fetch = original;
  }
});

test('completing the onboarding creates the brand, updates the company and imports the found logo without blocking', async () => {
  const session = { id: 'session', status: 'READY', findings: { logoUrl: 'https://www.vidros.com.br/logo.png' } };
  const calls = [];
  const useCase = new CompleteOnboardingUseCase(
    { findById: async () => session, complete: async (...args) => { calls.push(['complete', ...args]); return { brandId: 'brand' }; } },
    { companyId: 'company' },
    { execute: async (brandId, file) => calls.push(['logo', brandId, file.toString()]) },
    { download: async url => Buffer.from(`imagem de ${url}`) },
  );
  const result = await useCase.execute({ sessionId: 'session', useFoundLogo: true, company: { name: 'Vidros BR', website: 'vidros.com.br', instagramHandle: '@VidrosBR', segment: ' ' }, brand: { name: 'Vidros BR' } });
  assert.deepEqual(result, { brandId: 'brand', logoImported: true });
  assert.deepEqual(calls[0], ['complete', 'company', 'session', {
    company: { name: 'Vidros BR', website: 'https://vidros.com.br/', instagramHandle: 'vidrosbr', segment: null, description: null, phone: null, serviceArea: null }, brand: { name: 'Vidros BR' },
  }]);
  assert.deepEqual(calls[1], ['logo', 'brand', 'imagem de https://www.vidros.com.br/logo.png']);

  const failingLogo = new CompleteOnboardingUseCase(
    { findById: async () => session, complete: async () => ({ brandId: 'brand' }) }, { companyId: 'company' },
    { execute: async () => { throw new Error('imagem inválida'); } }, { download: async () => Buffer.from('x') },
  );
  assert.deepEqual(await failingLogo.execute({ sessionId: 'session', useFoundLogo: true, company: { name: 'X' }, brand: { name: 'X' } }), { brandId: 'brand', logoImported: false });

  const researching = new CompleteOnboardingUseCase({ findById: async () => ({ ...session, status: 'RESEARCHING' }) }, { companyId: 'company' }, {}, {});
  await assert.rejects(researching.execute({ sessionId: 'session', company: { name: 'X' }, brand: { name: 'X' } }), /em andamento/);
});

test('the OpenAI extractor asks for a strict structured output and maps, clamps and validates the profile', async () => {
  const { OpenAiBusinessProfileExtractor, strictSchema } = require('../dist/modules/onboarding/infra/providers/openai-business-profile.extractor');
  process.env.OPENAI_API_KEY = 'sk-test';
  const extractor = new OpenAiBusinessProfileExtractor({ get: key => ({ OPENAI_MODEL: 'gpt-4.1-mini' })[key] });
  const profile = {
    company: { name: 'Vidros BR', segment: '  ', description: 'x'.repeat(700), serviceArea: 'Itajaí', phone: null, website: null, instagramHandle: null },
    brand: { name: 'Vidros BR', primaryColor: '#0b3a82', secondaryColor: null, tertiaryColor: null, quaternaryColor: null, voiceTone: 'Próximo', targetAudience: null, copyGuidelines: null },
    products: [{ name: 'Fachadas', description: null }, { name: ' ', description: null }], otherBrands: [], logoUrl: null,
    sources: [{ field: 'company.name', source: 'website' }],
  };
  const calls = [];
  const reply = (body, status = 200) => { extractor.fetch = async (url, init) => { calls.push({ url, body: JSON.parse(init.body), auth: init.headers.authorization }); return Response.json(body, { status }); }; };
  reply({ status: 'completed', output: [{ type: 'reasoning' }, { type: 'message', content: [{ type: 'output_text', text: JSON.stringify(profile) }] }] });

  const result = await extractor.extract({ websiteUrl: 'https://www.vidros.com.br/', instagramHandle: null, website: null, instagram: null });
  assert.equal(calls[0].url, 'https://api.openai.com/v1/responses');
  assert.equal(calls[0].auth, 'Bearer sk-test');
  assert.equal(calls[0].body.model, 'gpt-4.1-mini');
  assert.deepEqual({ type: calls[0].body.text.format.type, strict: calls[0].body.text.format.strict }, { type: 'json_schema', strict: true });
  assert.match(calls[0].body.input, /<dados>[\s\S]*vidros\.com\.br[\s\S]*<\/dados>/);
  const schema = JSON.stringify(strictSchema());
  assert.equal(schema.includes('maxLength') || schema.includes('$schema'), false, 'strict mode does not accept maxLength');
  assert.equal(result.company.segment, null, 'blank text becomes null');
  assert.equal(result.company.description.length, 600, 'long text is clamped to the registration limit');
  assert.deepEqual(result.products, [{ name: 'Fachadas', description: null }]);
  assert.deepEqual(result.sources, { 'company.name': 'website' });

  reply({ status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'não' }] }] });
  await assert.rejects(extractor.extract({}), /recusou/);
  reply({ status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output: [] });
  await assert.rejects(extractor.extract({}), /incompleta/);
  reply({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: '{"company":{}}' }] }] });
  await assert.rejects(extractor.extract({}), /formato inesperado/);
  reply({ error: { code: 'insufficient_quota' } }, 429);
  await assert.rejects(extractor.extract({}), /limite de uso ou falta de créditos/);
});
