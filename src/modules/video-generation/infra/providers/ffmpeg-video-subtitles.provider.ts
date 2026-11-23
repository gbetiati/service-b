import { execFile } from 'node:child_process';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';
import { Injectable } from '@nestjs/common';
import { StorageProvider } from '@/shared/libs/storage/storage.provider';
import { VideoSubtitlesProvider } from '../../domain/providers/video-subtitles.provider';

const execute = promisify(execFile);

@Injectable()
export class FfmpegVideoSubtitlesProvider implements VideoSubtitlesProvider {
  constructor(private readonly storageProvider: StorageProvider) {}

  async burn (storageKey: string, srt: string) {
    if (!srt.trim()) return storageKey;

    const directory = await mkdtemp(join(tmpdir(), 'service-b-subtitles-'));
    try {
      const input = await this.storageProvider.open(storageKey);
      await pipeline(input, createWriteStream(join(directory, 'input.mp4')), { signal: AbortSignal.timeout(60_000) });
      await writeFile(join(directory, 'captions.srt'), srt, 'utf8');
      await execute('ffmpeg', [
        '-nostdin', '-v', 'error', '-protocol_whitelist', 'file', '-f', 'mov', '-i', 'input.mp4',
        '-map', '0:v:0', '-map', '0:a?', '-vf', 'subtitles=captions.srt',
        '-c:v', 'libx264', '-preset', 'fast', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-movflags', '+faststart', 'captioned.mp4',
      ], { cwd: directory, timeout: 120_000, maxBuffer: 256 * 1024 });

      const outputKey = storageKey.replace(/\.mp4$/i, '') + '.captioned.mp4';
      const output = createReadStream(join(directory, 'captioned.mp4'));
      try {
        await this.storageProvider.put(outputKey, output, 'video/mp4');
      } finally {
        output.destroy();
      }
      return outputKey;
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
}
