const assert = require('node:assert/strict');
const { test } = require('node:test');
const { Logger } = require('@nestjs/common');
const { RefreshExpiringInstagramTokensUseCase } = require('../dist/modules/social-account/application/use-cases/refresh-expiring-instagram-tokens.usecase');
const { REFRESH_BEFORE_EXPIRY_MS, MIN_REFRESH_AGE_MS } = require('../dist/modules/social-account/domain/entities/social-credential.entity');
const { RequestContext } = require('../dist/shared/core/request-context/request-context');
const { AppError } = require('../dist/shared/core/errors/app.error');

Logger.overrideLogger(false);

test('RefreshExpiringInstagramTokensUseCase disconnects expired accounts and refreshes the ones close to expiry in their company', async () => {
  const now = Date.parse('2026-11-25T12:00:00Z');
  const context = new RequestContext();
  const calls = [];
  const repository = {
    disconnectExpired: async date => { calls.push(['disconnect', date.getTime()]); return 2; },
    findCredentialsToRefresh: async (expiringBefore, updatedBefore, limit) => {
      calls.push(['find', expiringBefore.getTime(), updatedBefore.getTime(), limit]);
      return [{ companyId: 'company-a', socialAccountId: 'account-1' }, { companyId: 'company-b', socialAccountId: 'account-2' }, { companyId: 'company-a', socialAccountId: 'account-3' }];
    },
  };
  const refresher = {
    execute: async id => {
      calls.push(['refresh', id, context.companyId]);
      if (id === 'account-2') throw new AppError('upstream', 'Serviço externo retornou HTTP 400.');
      return { expiresAt: new Date(now + 60 * 86_400_000) };
    },
  };
  const result = await new RefreshExpiringInstagramTokensUseCase(repository, refresher, context).execute(now);

  assert.deepEqual(result, { disconnected: 2, refreshed: 2, failed: 1 }, 'one failure does not stop the other accounts');
  assert.deepEqual(calls, [
    ['disconnect', now],
    ['find', now + REFRESH_BEFORE_EXPIRY_MS, now - MIN_REFRESH_AGE_MS, 50],
    ['refresh', 'account-1', 'company-a'],
    ['refresh', 'account-2', 'company-b'],
    ['refresh', 'account-3', 'company-a'],
  ], 'expired accounts go first, then each refresh runs in the account company');
  assert.equal(REFRESH_BEFORE_EXPIRY_MS, 10 * 86_400_000);
});

const { ExternalApiProvider, ExternalApiError } = require('../dist/shared/libs/http/external-api.provider');
const { InstagramProvider } = require('../dist/modules/social-account/infra/providers/instagram.provider');

test('ExternalApiProvider keeps the status and body of an error response for the service provider to explain', async () => {
  const realFetch = globalThis.fetch;
  const provider = new ExternalApiProvider();
  try {
    globalThis.fetch = async () => Response.json({ error: { message: 'Invalid OAuth access token.', code: 190 } }, { status: 400 });
    await assert.rejects(provider.json('https://graph.test/me'), error => error instanceof ExternalApiError && error.kind === 'upstream'
      && error.status === 400 && error.body.error.code === 190 && error.message === 'Serviço externo retornou HTTP 400.');
    globalThis.fetch = async () => new Response('Bad gateway', { status: 502 });
    await assert.rejects(provider.json('https://graph.test/me'), error => error instanceof ExternalApiError && error.body === 'Bad gateway');
    globalThis.fetch = async () => Response.json({ ok: true });
    assert.deepEqual(await provider.json('https://graph.test/me'), { ok: true });
    globalThis.fetch = async () => { throw new TypeError('fetch failed'); };
    await assert.rejects(provider.json('https://graph.test/me'), error => error instanceof AppError && !(error instanceof ExternalApiError) && error.message === 'Falha na comunicação com o serviço externo.');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('InstagramProvider explains Meta errors and logs the diagnosis without tokens', async () => {
  Object.assign(process.env, { INSTAGRAM_APP_ID: 'app', INSTAGRAM_APP_SECRET: 'secret', INSTAGRAM_GRAPH_VERSION: 'v27.0', SERVICE_BASE_URL: 'https://api.test' });
  const logs = [];
  Logger.overrideLogger({ log () {}, error () {}, debug () {}, verbose () {}, warn: message => logs.push(message) });
  let failure;
  const instagram = new InstagramProvider({ json: async () => { throw failure; } });
  const rejectsWith = (promise, message) => assert.rejects(promise, error => error instanceof AppError && error.kind === 'upstream' && error.message === message);
  try {
    failure = new ExternalApiError(400, { error_type: 'OAuthException', code: 400, error_message: 'Invalid authorization code' });
    await rejectsWith(instagram.connect('used-code'), 'O código de autorização é inválido ou já foi usado. Conecte de novo.');
    failure = new ExternalApiError(400, { error_type: 'OAuthException', code: 400, error_message: 'Error validating verification code. Please make sure your redirect_uri is identical' });
    await rejectsWith(instagram.connect('code'), 'A URL de retorno não confere com a registrada no app da Meta.');
    failure = new ExternalApiError(400, { error_type: 'OAuthException', code: 400, error_message: 'Invalid platform app' });
    await rejectsWith(instagram.connect('code'), 'O Instagram não reconheceu o app. Se a URL de login do painel da Meta começa com facebook.com e tem config_id (login unificado), defina INSTAGRAM_CONFIG_ID; senão, use em INSTAGRAM_APP_ID e INSTAGRAM_APP_SECRET o ID e a chave do app do Instagram.');
    failure = new ExternalApiError(400, { error: { message: 'Error validating access token: Session has expired', type: 'OAuthException', code: 190, error_subcode: 463, fbtrace_id: 'AbC123' } });
    await rejectsWith(instagram.refresh('secret-long-token'), 'O acesso ao Instagram expirou ou foi revogado. Conecte a conta novamente.');
    failure = new ExternalApiError(400, { error: { message: 'Application request limit reached', code: 4 } });
    await rejectsWith(instagram.containerStatus('123', 'secret-long-token'), 'O Instagram limitou as requisições. Tente novamente em alguns minutos.');
    failure = new ExternalApiError(400, { error: { message: 'The video file you selected is in a format that we do not support.', code: 352 } });
    await rejectsWith(instagram.createVideo('1', 'secret-long-token', 'https://cdn.test/v.mp4', 'Legenda'), 'O Instagram recusou a requisição: The video file you selected is in a format that we do not support.');
    failure = new ExternalApiError(500, 'Internal error');
    await rejectsWith(instagram.publish('1', '2', 'secret-long-token'), 'O Instagram recusou a requisição (HTTP 500).');
    failure = new AppError('upstream', 'Falha na comunicação com o serviço externo.');
    await rejectsWith(instagram.publish('1', '2', 'secret-long-token'), 'Falha na comunicação com o serviço externo.');
  } finally {
    Logger.overrideLogger(false);
  }
  assert.equal(logs.length, 7, 'each Meta error is logged once');
  assert.match(logs[3], /caminho=\/refresh_access_token status=400 código=190 subcódigo=463 tipo=OAuthException fbtrace_id=AbC123/);
  assert.ok(logs.every(line => !line.includes('secret-long-token') && !line.includes('used-code') && !line.includes('secret')), 'tokens, codes and the app secret never reach the log');
});

const { FacebookBusinessLoginProvider } = require('../dist/modules/social-account/infra/providers/facebook-business-login.provider');

// Graph do Facebook falsa: responde pelo caminho e guarda cada chamada.
function fakeGraph (routes) {
  const calls = [];
  return { calls, api: { json: async (url, init) => {
    const target = new URL(url);
    calls.push({ path: target.pathname, query: Object.fromEntries(target.searchParams), auth: init?.headers?.Authorization });
    const route = routes[target.pathname.replace(/^\/v27\.0\//, '')];
    if (!route) throw new Error('rota inesperada ' + target.pathname);
    return typeof route === 'function' ? route(target.searchParams) : route;
  } } };
}

test('FacebookBusinessLoginProvider authorizes with the configuration of the unified login', () => {
  Object.assign(process.env, { INSTAGRAM_APP_ID: 'app', INSTAGRAM_APP_SECRET: 'secret', INSTAGRAM_GRAPH_VERSION: 'v27.0', SERVICE_BASE_URL: 'https://api.test', INSTAGRAM_CONFIG_ID: 'config-1' });
  const url = new URL(new FacebookBusinessLoginProvider(fakeGraph({}).api).authorizationUrl('state-1'));
  assert.equal(url.origin + url.pathname, 'https://www.facebook.com/v27.0/dialog/oauth');
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    client_id: 'app', config_id: 'config-1', redirect_uri: 'https://api.test/social-accounts/instagram/callback',
    response_type: 'code', override_default_response_type: 'true', state: 'state-1',
  });
});

test('FacebookBusinessLoginProvider connects the Instagram account granted with a token that does not expire', async () => {
  const before = Date.now();
  const graph = fakeGraph({
    'oauth/access_token': { access_token: 'system-token' },
    debug_token: { data: { app_id: 'app', is_valid: true, expires_at: 0, scopes: ['instagram_basic', 'instagram_content_publish', 'pages_show_list'], granular_scopes: [{ scope: 'pages_show_list', target_ids: ['page-1'] }, { scope: 'instagram_content_publish', target_ids: ['1789'] }] } },
    '1789': { id: '1789', username: 'loja', name: 'Loja' },
  });
  const account = await new FacebookBusinessLoginProvider(graph.api).connect('code-1');
  assert.deepEqual({ ...account, expiresAt: undefined }, { accessToken: 'system-token', expiresAt: undefined, externalId: '1789', handle: 'loja', displayName: 'Loja', scopes: ['instagram_basic', 'instagram_content_publish', 'pages_show_list'] });
  assert.ok(account.expiresAt.getTime() >= before + 60 * 86_400_000 - 1000, 'a token that does not expire is checked again in 60 days');
  assert.deepEqual(graph.calls.map(call => call.path), ['/v27.0/oauth/access_token', '/v27.0/debug_token', '/v27.0/1789'], 'no long-lived exchange and no page lookup');
  assert.deepEqual(graph.calls[0].query, { client_id: 'app', client_secret: 'secret', redirect_uri: 'https://api.test/social-accounts/instagram/callback', code: 'code-1' });
  assert.deepEqual(graph.calls[1].query, { input_token: 'system-token', access_token: 'app|secret' });
  assert.equal(graph.calls[2].auth, 'Bearer system-token');
});

test('FacebookBusinessLoginProvider exchanges a user token for a long-lived one and finds the account through the pages', async () => {
  const expiresSoon = Math.floor(Date.now() / 1000) + 3600;
  const expiresLater = Math.floor(Date.now() / 1000) + 60 * 86_400;
  const graph = fakeGraph({
    'oauth/access_token': query => ({ access_token: query.get('grant_type') === 'fb_exchange_token' ? 'long-user-token' : 'short-user-token' }),
    debug_token: query => ({ data: { app_id: 'app', is_valid: true, expires_at: query.get('input_token') === 'long-user-token' ? expiresLater : expiresSoon, scopes: ['instagram_basic', 'instagram_content_publish'] } }),
    'me/accounts': { data: [{ id: 'page-1' }, { id: 'page-2', instagram_business_account: { id: '2001' } }] },
    '2001': { id: '2001', username: 'marca' },
  });
  const account = await new FacebookBusinessLoginProvider(graph.api).connect('code-2');
  assert.deepEqual([account.accessToken, account.externalId, account.handle, account.displayName], ['long-user-token', '2001', 'marca', null]);
  assert.equal(account.expiresAt.getTime(), expiresLater * 1000);
  assert.deepEqual(graph.calls[2].query, { client_id: 'app', client_secret: 'secret', grant_type: 'fb_exchange_token', fb_exchange_token: 'short-user-token' });
});

test('FacebookBusinessLoginProvider rejects tokens without the publishing permission, from another app or without an Instagram account', async () => {
  const connect = debug => new FacebookBusinessLoginProvider(fakeGraph({
    'oauth/access_token': { access_token: 'token' }, debug_token: { data: { app_id: 'app', is_valid: true, expires_at: 0, ...debug } }, 'me/accounts': { data: [] },
  }).api).connect('code');
  await assert.rejects(connect({ scopes: ['instagram_basic'] }), error => error instanceof AppError && error.kind === 'invalid' && /publicação/.test(error.message));
  await assert.rejects(connect({ app_id: 'other-app' }), error => error instanceof AppError && error.kind === 'upstream');
  await assert.rejects(connect({ scopes: ['instagram_basic', 'instagram_content_publish'] }), error => error instanceof AppError && error.kind === 'invalid' && /Nenhuma conta/.test(error.message));
});

test('FacebookBusinessLoginProvider renews by checking the token again with Meta', async () => {
  const refresh = debug => new FacebookBusinessLoginProvider(fakeGraph({ debug_token: { data: { app_id: 'app', ...debug } } }).api).refresh('token');
  const renewed = await refresh({ is_valid: true, expires_at: 0 });
  assert.equal(renewed.accessToken, 'token');
  assert.ok(renewed.expiresAt.getTime() > Date.now() + 59 * 86_400_000);
  await assert.rejects(refresh({ is_valid: false, expires_at: 0 }), error => error instanceof AppError && /revogado/.test(error.message));
  await assert.rejects(refresh({ is_valid: true, expires_at: Math.floor(Date.now() / 1000) + 3600 }), error => error instanceof AppError && error.kind === 'conflict');
});
