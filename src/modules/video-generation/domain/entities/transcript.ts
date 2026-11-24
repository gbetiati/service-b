const cueTiming = /^\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}$/;

export type Transcript = { text: string; srt: string };

// Valida e normaliza um SRT. Um SRT vazio é válido e resulta em vídeo sem legendas; um SRT malformado retorna null.
export function parseSrtTranscript (srt: string): Transcript | null {
  const normalized = srt.trim().replace(/\r\n/g, '\n');
  const cues = (normalized ? normalized.split(/\n[ \t]*\n/) : []).map(cue => cue.split('\n'));

  if (cues.some(([index, range, text]) => !/^\d+$/.test(index) || !cueTiming.test(range) || !text)) return null;

  const text = cues.map(cue => cue.slice(2).join(' ')).join(' ');
  return { text, srt: normalized ? normalized + '\n' : '' };
}
