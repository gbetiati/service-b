import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { Injectable } from '@nestjs/common';
import { AppError } from '@/shared/core/errors/app.error';
import { VideoFileInspector } from '../../domain/providers/video-file-inspector.provider';

const execute = promisify(execFile);
const invalidVideo = 'Envie um arquivo MP4 válido com uma faixa de vídeo.';

@Injectable()
export class FfprobeVideoFileInspector implements VideoFileInspector {
  async validateMp4 (file: Buffer) {
    const brand = file.toString('latin1', 8, 12);
    if (file.toString('latin1', 4, 8) !== 'ftyp' || !/^(isom|iso[2-9]|mp4[12]|avc1|M4V |MSNV|dash)$/.test(brand)) {
      throw new AppError('invalid', invalidVideo);
    }

    const directory = await mkdtemp(join(tmpdir(), 'service-b-product-media-'));
    const path = join(directory, 'upload.mp4');
    try {
      await writeFile(path, file);
      const { stdout } = await execute('ffprobe', [
        '-v', 'error', '-protocol_whitelist', 'file', '-enable_drefs', '0', '-f', 'mov',
        '-select_streams', 'V:0', '-show_entries', 'stream=width,height', '-of', 'json', path,
      ], { timeout: 5000, maxBuffer: 16 * 1024 }).catch((error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') throw new AppError('unavailable', 'FFprobe indisponível para validar o vídeo.');
        throw new AppError('invalid', invalidVideo);
      });
      const stream = (JSON.parse(stdout) as { streams?: { width: number; height: number }[] }).streams?.[0];
      if (!((stream?.width ?? 0) > 0 && (stream?.height ?? 0) > 0)) throw new AppError('invalid', invalidVideo);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
}
