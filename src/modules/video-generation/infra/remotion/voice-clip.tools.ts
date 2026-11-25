import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Injectable } from '@nestjs/common';
import { AppError } from '@/shared/core/errors/app.error';
import type { Silence } from '../../domain/entities/voice-alignment';

type Execute = (file: string, args: string[], options: { timeout: number; maxBuffer: number }) => Promise<{ stdout: string; stderr: string }>;

// Trecho do áudio, em segundos. Sem `end`, vai até o fim.
export type ClipRange = { start: number; end?: number };

// Aceleração aplicada a cada fala. As instruções já pedem um ritmo dinâmico; 1,1x dá folga para o roteiro caber nos
// 15 s sem atropelar a voz (o atempo não muda o tom).
export const VOICE_TEMPO = 1.1;

// Corta o silêncio do começo e do fim (o TTS deixa de 0,2 a 0,7 s em cada ponta), acelera a fala e normaliza o volume
// para -16 LUFS, o padrão de vídeo em redes sociais: a voz da OpenAI sai baixa (cerca de -30 dB) e sumia sob a música.
const TIGHTEN_FILTER = [
  'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.04',
  'areverse',
  'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08',
  'areverse',
  `atempo=${VOICE_TEMPO}`,
  'loudnorm=I=-16:TP=-1.5:LRA=11',
].join(',');

// Pausa mínima considerada na detecção: as pausas entre frases do TTS ficam entre 0,2 e 0,6 s.
const SILENCE_FILTER = 'silencedetect=noise=-40dB:d=0.12';

// Ajuste e medição dos clipes da locução com FFmpeg e FFprobe, para o template encaixar cada fala na cena.
@Injectable()
export class VoiceClipTools {
  protected execute: Execute = promisify(execFile) as unknown as Execute;

  // Prepara um clipe da fala. Com `range`, usa só esse trecho do áudio (um trecho do roteiro gravado numa tomada só).
  async tighten (input: string, output: string, range?: ClipRange) {
    const cut = range ? ['-ss', String(range.start), ...(range.end !== undefined ? ['-to', String(range.end)] : [])] : [];
    await this.execute('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-protocol_whitelist', 'file', ...cut, '-i', input, '-af', TIGHTEN_FILTER, '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '128k', '-y', output,
    ], { timeout: 15000, maxBuffer: 64 * 1024 }).catch(error => fail(error, 'FFmpeg indisponível para preparar a locução.', 'Não foi possível preparar o áudio da locução.'));
  }

  // Pausas do áudio, na ordem. Uma pausa que vai até o fim do arquivo não entra: não separa dois trechos.
  async silences (input: string): Promise<Silence[]> {
    const { stderr } = await this.execute('ffmpeg', [
      '-hide_banner', '-nostats', '-loglevel', 'info', '-protocol_whitelist', 'file', '-i', input, '-af', SILENCE_FILTER, '-f', 'null', '-',
    ], { timeout: 15000, maxBuffer: 1024 * 1024 }).catch(error => fail(error, 'FFmpeg indisponível para analisar a locução.', 'Não foi possível analisar o áudio da locução.'));
    const starts = [...stderr.matchAll(/silence_start: (-?[\d.]+)/g)].map(match => Math.max(0, Number(match[1])));
    const ends = [...stderr.matchAll(/silence_end: ([\d.]+)/g)].map(match => Number(match[1]));
    return ends.map((end, index) => ({ start: starts[index], end })).filter(({ start, end }) => Number.isFinite(start) && Number.isFinite(end) && end > start);
  }

  async seconds (path: string) {
    const { stdout } = await this.execute('ffprobe', [
      '-v', 'error', '-protocol_whitelist', 'file', '-show_entries', 'format=duration', '-of', 'csv=p=0', path,
    ], { timeout: 5000, maxBuffer: 16 * 1024 }).catch(error => fail(error, 'FFprobe indisponível para medir a locução.', 'Não foi possível ler o áudio da locução.'));
    const seconds = Number(stdout.trim());

    if (!Number.isFinite(seconds) || seconds <= 0) throw new AppError('upstream', 'Não foi possível ler o áudio da locução.');

    return seconds;
  }
}

function fail (error: NodeJS.ErrnoException, unavailable: string, upstream: string): never {
  if (error.code === 'ENOENT') throw new AppError('unavailable', unavailable);

  throw new AppError('upstream', upstream);
}
