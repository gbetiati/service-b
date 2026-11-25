const assert = require('node:assert/strict');
const { test } = require('node:test');
const { Logger } = require('@nestjs/common');
const { alignVoiceLines } = require('../dist/modules/video-generation/domain/entities/voice-alignment');
const { OpenAiTranscriptionProvider } = require('../dist/modules/video-generation/infra/providers/openai-transcription.provider');
const { VoiceClipTools } = require('../dist/modules/video-generation/infra/remotion/voice-clip.tools');
const { AppError } = require('../dist/shared/core/errors/app.error');

Logger.overrideLogger(false);

const config = values => ({ get: key => values[key] });
const lines = ['Corra mais leve', 'Amortecimento macio', 'Garanta o seu'];
// Palavras como o Whisper devolve: com pontuação, maiúsculas e o fim de cada palavra um pouco atrasado.
const words = [
  ['Corra', 0, 0.3], ['mais', 0.3, 0.55], ['leve.', 0.55, 1.0],
  ['Amortecimento', 1.5, 2.2], ['macio.', 2.2, 2.7],
  ['Garanta', 3.1, 3.5], ['o', 3.5, 3.6], ['seu!', 3.6, 4.0],
].map(([text, start, end]) => ({ text, start, end }));
const silences = [{ start: 0.9, end: 1.5 }, { start: 2.65, end: 3.1 }];

test('alignVoiceLines cuts in the middle of the pause between scenes', () => {
  assert.deepEqual(alignVoiceLines(lines, words, silences), { ok: true, cuts: [1.2, 2.875] });
});

test('alignVoiceLines tolerates accents, case and small transcription mistakes', () => {
  const heard = words.map(word => word.text === 'Amortecimento' ? { ...word, text: 'amortecimênto' } : word);
  assert.equal(alignVoiceLines(lines, heard, silences).ok, true);
  assert.equal(alignVoiceLines(['Cabedal respirável'], [{ text: 'Cabedal', start: 0, end: 0.4 }, { text: 'respiravel', start: 0.4, end: 1 }], []).ok, true);
});

test('alignVoiceLines picks the longest pause near the boundary, not a comma inside the scene', () => {
  const comma = { start: 0.3, end: 0.4 };
  assert.deepEqual(alignVoiceLines(lines, words, [comma, ...silences]).cuts, [1.2, 2.875]);
});

test('alignVoiceLines rejects a take with a missing scene, extra speech or no pause between scenes', () => {
  assert.deepEqual(alignVoiceLines(lines, words.slice(0, 5), silences), { ok: false, reason: 'o trecho 3 não foi reconhecido na locução' });
  const chatter = ['Olá', 'tudo', 'bem', 'pessoal', 'hoje', 'vamos', 'falar', 'de', 'tênis', 'e'].map((text, index) => ({ text, start: 5 + index * 0.2, end: 5.2 + index * 0.2 }));
  assert.deepEqual(alignVoiceLines(lines, [...words, ...chatter], silences), { ok: false, reason: 'a locução tem falas fora do roteiro' });
  assert.deepEqual(alignVoiceLines(lines, words, silences.slice(0, 1)), { ok: false, reason: 'sem pausa entre os trechos 2 e 3' });
  assert.deepEqual(alignVoiceLines(lines, words, [{ start: 0.9, end: 3.1 }]), { ok: false, reason: 'sem pausa entre os trechos 2 e 3' }, 'one pause cannot separate two boundaries');
});

test('OpenAiTranscriptionProvider asks whisper-1 for word timestamps in Portuguese', async () => {
  process.env.OPENAI_API_KEY = 'sk-test';
  const provider = new OpenAiTranscriptionProvider(config({}));
  const calls = [];
  provider.fetch = async (url, init) => {
    calls.push({ url, init });
    return Response.json({ text: 'Corra mais leve.', words: [{ word: 'Corra', start: 0, end: 0.3 }, { word: 'leve', start: 0.5, end: 0.9 }] });
  };
  const result = await provider.transcribe({ audio: Buffer.from('RIFF-audio'), language: 'pt' });
  assert.deepEqual(result, [{ text: 'Corra', start: 0, end: 0.3 }, { text: 'leve', start: 0.5, end: 0.9 }]);
  assert.equal(calls[0].url, 'https://api.openai.com/v1/audio/transcriptions');
  assert.equal(calls[0].init.headers.authorization, 'Bearer sk-test');
  const form = calls[0].init.body;
  assert.deepEqual(
    { model: form.get('model'), language: form.get('language'), format: form.get('response_format'), granularity: form.getAll('timestamp_granularities[]') },
    { model: 'whisper-1', language: 'pt', format: 'verbose_json', granularity: ['word'] },
  );
  assert.equal(Buffer.from(await form.get('file').arrayBuffer()).toString(), 'RIFF-audio');
  assert.equal(form.get('prompt'), null, 'the script is not sent as a hint, so the check hears only what was spoken');

  provider.fetch = async () => Response.json({ text: 'sem palavras' });
  await assert.rejects(provider.transcribe({ audio: Buffer.from('a'), language: 'pt' }), error => error instanceof AppError && error.kind === 'upstream');
  provider.fetch = async () => Response.json({ error: { code: 'insufficient_quota' } }, { status: 429 });
  await assert.rejects(provider.transcribe({ audio: Buffer.from('a'), language: 'pt' }), error => error instanceof AppError && error.kind === 'upstream');
  await assert.rejects(provider.transcribe({ audio: Buffer.alloc(0), language: 'pt' }), error => error instanceof AppError && error.kind === 'invalid');
  delete process.env.OPENAI_API_KEY;
  await assert.rejects(provider.transcribe({ audio: Buffer.from('a'), language: 'pt' }), error => error instanceof AppError && error.kind === 'unavailable');
});

test('VoiceClipTools reads the pauses from FFmpeg and cuts a range of the take', async () => {
  const tools = new VoiceClipTools();
  const calls = [];
  tools.execute = async (file, args) => {
    calls.push(args);
    return { stdout: '', stderr: '[silencedetect] silence_start: -0.01\n[silencedetect] silence_end: 0.2 | silence_duration: 0.21\n[silencedetect] silence_start: 1.4\n[silencedetect] silence_end: 1.9 | silence_duration: 0.5\n[silencedetect] silence_start: 3.2\n' };
  };
  assert.deepEqual(await tools.silences('/tmp/take.wav'), [{ start: 0, end: 0.2 }, { start: 1.4, end: 1.9 }], 'a pause running to the end of the file is ignored');
  assert.ok(calls[0].includes('silencedetect=noise=-40dB:d=0.12'));

  await tools.tighten('/tmp/take.wav', '/tmp/clip.mp3', { start: 1.65, end: 3.1 });
  assert.deepEqual(calls[1].slice(calls[1].indexOf('-ss'), calls[1].indexOf('-i') + 2), ['-ss', '1.65', '-to', '3.1', '-i', '/tmp/take.wav']);
  await tools.tighten('/tmp/take.wav', '/tmp/clip.mp3', { start: 3.1 });
  assert.equal(calls[2].includes('-to'), false, 'the last scene runs to the end of the take');
  await tools.tighten('/tmp/raw.wav', '/tmp/clip.mp3');
  assert.equal(calls[3].includes('-ss'), false);

  tools.execute = async () => { throw Object.assign(new Error('spawn ffmpeg ENOENT'), { code: 'ENOENT' }); };
  await assert.rejects(tools.silences('/tmp/take.wav'), error => error instanceof AppError && error.kind === 'unavailable');
});
