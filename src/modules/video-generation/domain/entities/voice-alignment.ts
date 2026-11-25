import type { TimedWord } from '../providers/transcription.provider';

// Trecho sem som no áudio, em segundos.
export type Silence = { start: number; end: number };

export type VoiceAlignment = { ok: true; cuts: number[] } | { ok: false; reason: string };

// Parte de cada trecho que precisa ser reconhecida na transcrição. Abaixo disso, a fala saiu cortada ou trocada.
const MIN_LINE_COVERAGE = 0.6;
// Parte da transcrição que precisa vir do roteiro. Abaixo disso, o TTS falou coisas que não estavam no texto.
const MIN_SCRIPT_SHARE = 0.5;
// O tempo das palavras no Whisper erra alguns décimos; a pausa entre dois trechos é procurada com essa folga.
const TIMING_TOLERANCE = 0.2;

// Confere a locução gravada numa tomada só contra o roteiro e devolve onde cortar entre cada trecho. O corte cai
// sempre numa pausa real entre o fim de um trecho e o começo do próximo, nunca no meio de uma palavra.
export function alignVoiceLines (lines: string[], words: TimedWord[], silences: Silence[]): VoiceAlignment {
  const expected = lines.flatMap((line, index) => tokens(line).map(token => ({ token, line: index })));
  const heard = words.map(word => ({ ...word, token: normalize(word.text) })).filter(word => word.token);
  const matches = matchTokens(expected.map(item => item.token), heard.map(word => word.token));

  if (matches.length < heard.length * MIN_SCRIPT_SHARE) return { ok: false, reason: 'a locução tem falas fora do roteiro' };

  const spoken = lines.map((_, index) => matches.filter(([e]) => expected[e].line === index).map(([, h]) => heard[h]));
  const missing = spoken.findIndex((found, index) => found.length < Math.max(1, tokens(lines[index]).length * MIN_LINE_COVERAGE));

  if (missing >= 0) return { ok: false, reason: `o trecho ${missing + 1} não foi reconhecido na locução` };

  const cuts: number[] = [];
  for (let index = 0; index < lines.length - 1; index++) {
    const from = Math.max(...spoken[index].map(word => word.end)) - TIMING_TOLERANCE;
    const to = Math.min(...spoken[index + 1].map(word => word.start)) + TIMING_TOLERANCE;
    const pause = silences.filter(silence => silence.end > from && silence.start < to).sort((a, b) => (b.end - b.start) - (a.end - a.start))[0];
    const cut = pause && (pause.start + pause.end) / 2;

    if (cut === undefined || cut <= (cuts[cuts.length - 1] ?? 0)) return { ok: false, reason: `sem pausa entre os trechos ${index + 1} e ${index + 2}` };

    cuts.push(cut);
  }
  return { ok: true, cuts };
}

function tokens (text: string) {
  return text.split(/\s+/).map(normalize).filter(Boolean);
}

// Minúsculas, sem acento e sem pontuação: "Leve," e "leve" são a mesma palavra.
function normalize (word: string) {
  return word.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

// Palavras parecidas contam como a mesma, para tolerar pequenos erros de grafia da transcrição.
function similar (a: string, b: string) {
  if (a === b) return true;

  const shorter = Math.min(a.length, b.length);
  return shorter >= 4 && distance(a, b) <= (shorter >= 7 ? 2 : 1);
}

function distance (a: string, b: string) {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    previous = current;
  }
  return previous[b.length];
}

// Maior sequência comum entre o roteiro e o que foi ouvido, mantendo a ordem. Devolve pares [índice no roteiro, índice ouvido].
function matchTokens (expected: string[], heard: string[]): [number, number][] {
  const table = Array.from({ length: expected.length + 1 }, () => new Array<number>(heard.length + 1).fill(0));
  for (let i = expected.length - 1; i >= 0; i--) {
    for (let j = heard.length - 1; j >= 0; j--) table[i][j] = similar(expected[i], heard[j]) ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
  }
  const pairs: [number, number][] = [];
  for (let i = 0, j = 0; i < expected.length && j < heard.length;) {
    if (similar(expected[i], heard[j]) && table[i][j] === table[i + 1][j + 1] + 1) pairs.push([i++, j++]);
    else if (table[i + 1][j] >= table[i][j + 1]) i++;
    else j++;
  }
  return pairs;
}
