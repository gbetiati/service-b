import { execFile } from 'node:child_process';
import { createReadStream, createWriteStream } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';
import { Injectable } from '@nestjs/common';
import { AppError } from '@/shared/core/errors/app.error';
import { withTemporaryDirectory } from '@/shared/core/fs/temporary-directory';
import { StorageProvider } from '@/shared/libs/storage/storage.provider';
import { VideoSubtitlesProvider } from '../../domain/providers/video-subtitles.provider';

const execute = promisify(execFile);

@Injectable()
export class FfmpegVideoSubtitlesProvider implements VideoSubtitlesProvider {
  constructor(
    private readonly storageProvider: StorageProvider,
  ) {}

  // Um SRT vazio mantém o vídeo original.
  async burn (storageKey: string, srt: string) {
    if (!srt.trim()) return storageKey;

    return withTemporaryDirectory('service-b-subtitles-', async directory => {
      const input = await this.storageProvider.open(storageKey);
      await pipeline(input, createWriteStream(join(directory, 'input.mp4')), { signal: AbortSignal.timeout(60_000) });
      await writeFile(join(directory, 'captions.srt'), srt, 'utf8');
      await this.render(directory);
      const outputKey = storageKey.replace(/\.mp4$/i, '') + '.captioned.mp4';
      const output = createReadStream(join(directory, 'captioned.mp4'));
      try {
        await this.storageProvider.put(outputKey, output, 'video/mp4');
      } finally {
        output.destroy();
      }
      return outputKey;
    });
  }

  private async render (directory: string) {
    await execute(process.env.FFMPEG_BINARY?.trim() || 'ffmpeg', [
      '-nostdin', '-v', 'error', '-protocol_whitelist', 'file', '-f', 'mov', '-i', 'input.mp4',
      '-map', '0:v:0', '-map', '0:a?', '-vf', 'subtitles=captions.srt',
      '-c:v', 'libx264', '-preset', 'fast', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-movflags', '+faststart', 'captioned.mp4',
    ], { cwd: directory, timeout: 120_000, maxBuffer: 256 * 1024 }).catch((error: NodeJS.ErrnoException & { stderr?: string }) => {
      if (error.code === 'ENOENT') throw new AppError('upstream', 'Executável do FFmpeg não encontrado.');

      if (/(?:no such|unknown) filter[^\n]*subtitles/i.test(error.stderr ?? '')) throw new AppError('upstream', 'O FFmpeg configurado precisa do filtro subtitles (libass).');

      throw error;
    });
  }
}
