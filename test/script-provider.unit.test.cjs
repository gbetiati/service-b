const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { test } = require('node:test');
const { Logger } = require('@nestjs/common');
const { Webhook } = require('standardwebhooks');
const { formatAdScript, parseAdScript } = require('../dist/modules/content/domain/entities/ad-script');
const { Content } = require('../dist/modules/content/domain/entities/content.entity');
const { ContentAsset } = require('../dist/modules/content/domain/entities/content-asset.entity');
const { ClaudeScriptProvider, CLAUDE_SCRIPT_WEBHOOK_PATH } = require('../dist/modules/content/infra/providers/claude-script.provider');
const { ClaudeScriptWebhookController } = require('../dist/modules/video-generation/infra/controllers/claude-script-webhook.controller');
const { AppError } = require('../dist/shared/core/errors/app.error');

Logger.overrideLogger(false);
process.env.INTERNAL_WEBHOOK_SECRET = 'whsec_' + Buffer.from(randomUUID()).toString('base64');
process.env.ANTHROPIC_API_KEY = 'test-key';
process.env.PORT = '3999';

const scenes = { hook: 'Corra mais leve', benefits: ['Amortecimento macio', 'Cabedal respirável'], callToAction: 'Garanta o seu' };
const config = values => ({ get: key => values[key] });
const brief = { brand: 'Marca', objective: null, guidelines: 'Usar fotos reais.', products: ['Tênis'], voiceTone: 'Enérgico' };

test('ad scripts round-trip through the editable text format and reject anything else', () => {
  const text = formatAdScript(scenes);
  assert.equal(text, 'Gancho: Corra mais leve\nBenefícios:\n- Amortecimento macio\n- Cabedal respirável\nChamada: Garanta o seu');
  assert.deepEqual(parseAdScript(text), scenes);
  assert.deepEqual(parseAdScript('  ' + text.replace(/\n/g, '\r\n\r\n') + '  '), scenes, 'tolerates blank lines and CRLF');
  assert.equal(parseAdScript('Um roteiro livre, como o da OpenAI.'), null);
  assert.equal(parseAdScript(formatAdScript({ ...scenes, hook: 'x'.repeat(41) })), null);
  assert.equal(parseAdScript(formatAdScript({ ...scenes, benefits: ['Só um benefício'] })), null);
  assert.equal(parseAdScript(formatAdScript({ ...scenes, benefits: ['aaa', 'bbb', 'ccc', 'ddd', 'eee'] })), null);
});

test('the script brief carries the brand voice only when the brand has it', () => {
  const content = Content.create('company', {
    campaingId: 'campaign', campaingRulesId: 'rule', productId: 'product', productIds: [], aiScript: '', editorial: {}, assets: [new ContentAsset(0, 'image')],
  });
  const references = (brand) => ({
    campaign: { brandId: 'brand', objective: 'Vender', brand },
    rule: { campaingId: 'campaign', guidelines: 'Usar fotos reais.' },
    products: [{ id: 'product', brandId: 'brand', name: 'Tênis', description: null }],
    images: [{ id: 'image', productId: 'product', storageKey: 'k' }],
  });
  const empty = { name: 'Marca', primaryColor: '#ff5500', secondaryColor: null, voiceTone: null, targetAudience: null, copyGuidelines: null };
  assert.deepEqual(Object.keys(JSON.parse(JSON.stringify(content.buildScriptBrief(references(empty))))).sort(), ['brand', 'guidelines', 'objective', 'products']);
  const voiced = content.buildScriptBrief(references({ ...empty, voiceTone: 'Enérgico', targetAudience: 'Corredores', copyGuidelines: 'Sem jargão.' }));
  assert.equal(voiced.voiceTone, 'Enérgico');
  assert.equal(voiced.targetAudience, 'Corredores');
  assert.equal(voiced.copyGuidelines, 'Sem jargão.');
  assert.equal(voiced.primaryColor, undefined, 'colors never reach the text brief');
});

function claude (parse) {
  const calls = [];
  const sent = [];
  let resolveSent;
  const delivered = new Promise(resolve => { resolveSent = resolve; });
  const webhookClient = { send: async (url, secret, event) => { sent.push({ url, secret, event }); resolveSent(); return true; } };
  const provider = new ClaudeScriptProvider(config({ ANTHROPIC_MODEL: 'test-model' }), webhookClient);
  provider.client = { beta: { messages: { parse: async params => { calls.push(params); return parse(params); } } } };
  return { provider, calls, sent, delivered };
}

test('ClaudeScriptProvider writes the script in scenes with structured output and the brand voice in the briefing', async () => {
  const { provider, calls } = claude(() => ({ stop_reason: 'end_turn', parsed_output: scenes }));
  assert.equal(await provider.generate(brief), formatAdScript(scenes));
  assert.equal(calls[0].model, 'test-model');
  assert.ok(calls[0].output_config.format, 'uses output_config.format');
  assert.equal(calls[0].fallbacks, 'default');
  assert.match(calls[0].messages[0].content, /<briefing>[\s\S]*"voiceTone":"Enérgico"/);
  assert.match(calls[0].system, /Guia de copywriting/);
});

test('ClaudeScriptProvider requests in background and reports the script or the failure through the internal webhook', async () => {
  const ok = claude(() => ({ stop_reason: 'end_turn', parsed_output: scenes }));
  const submissionId = randomUUID();
  await ok.provider.request(brief, submissionId);
  await ok.delivered;
  assert.equal(ok.sent[0].url.href, `http://127.0.0.1:3999${CLAUDE_SCRIPT_WEBHOOK_PATH}`);
  assert.equal(ok.sent[0].secret, process.env.INTERNAL_WEBHOOK_SECRET);
  assert.deepEqual(ok.sent[0].event, { submissionId, outcome: { script: formatAdScript(scenes) } });

  const refused = claude(() => ({ stop_reason: 'refusal', parsed_output: null }));
  await refused.provider.request(brief, submissionId);
  await refused.delivered;
  assert.deepEqual(refused.sent[0].event, { submissionId, outcome: { error: 'O modelo recusou gerar o roteiro para este produto.' } });
});

function signed (event, secret = process.env.INTERNAL_WEBHOOK_SECRET) {
  const id = 'msg_' + randomUUID();
  const timestamp = new Date();
  const body = JSON.stringify(event);
  const headers = { 'webhook-id': id, 'webhook-timestamp': String(Math.floor(timestamp.getTime() / 1000)), 'webhook-signature': new Webhook(secret).sign(id, timestamp, body) };
  return { rawBody: Buffer.from(body), header: name => headers[name] };
}

test('ClaudeScriptWebhookController completes the script generation only for signed, well-formed events', async () => {
  const completed = [];
  const controller = new ClaudeScriptWebhookController({ execute: async result => completed.push(result) });
  const submissionId = randomUUID();
  await controller.receive(signed({ submissionId, outcome: { script: 'Gancho: x' } }));
  await controller.receive(signed({ submissionId, outcome: { error: 'Falhou.' } }));
  assert.deepEqual(completed, [{ submissionId, outcome: { script: 'Gancho: x' } }, { submissionId, outcome: { error: 'Falhou.' } }]);
  await assert.rejects(controller.receive(signed({ submissionId, outcome: {} })), /nem erro/);
  await assert.rejects(controller.receive(signed({ submissionId: 'x', outcome: { script: 'a' } })), /identificação/);
  await assert.rejects(controller.receive(signed({ submissionId, outcome: { script: 'a' } }, 'whsec_' + Buffer.from('outro').toString('base64'))), error => error instanceof AppError && error.kind === 'unauthorized');
  assert.equal(completed.length, 2);
});
