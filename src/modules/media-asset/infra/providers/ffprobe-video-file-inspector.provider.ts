import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { Injectable } from '@nestjs/common';
import { AppError } from '@/shared/core/errors/app.error';
import { withTemporaryDirectory } from '@/shared/core/fs/temporary-directory';
import { VideoFileInspector } from '../../domain/providers/video-file-inspector.provider';

const execute = promisify(execFile);
const invalidVideo = 'Envie um arquivo MP4 válido com uma faixa de vídeo.';
const mp4Brands = /^(isom|iso[2-9]|mp4[12]|avc1|M4V |MSNV|dash)$/;

@Injectable()
export class FfprobeVideoFileInspector implements VideoFileInspector {
  async validateMp4 (file: Buffer) {
    if (file.toString('latin1', 4, 8) !== 'ftyp' || !mp4Brands.test(file.toString('latin1', 8, 12))) throw new AppError('invalid', invalidVideo);

    await withTemporaryDirectory('service-b-product-media-', async directory => {
      const path = join(directory, 'upload.mp4');
      await writeFile(path, file);
      const { width, height } = await this.probeVideoStream(path);

      if (!(width > 0 && height > 0)) throw new AppError('invalid', invalidVideo);
    });
  }

  private async probeVideoStream (path: string) {
    const { stdout } = await execute('ffprobe', [
      '-v', 'error', '-protocol_whitelist', 'file', '-enable_drefs', '0', '-f', 'mov',
      '-select_streams', 'V:0', '-show_entries', 'stream=width,height', '-of', 'json', path,
    ], { timeout: 5000, maxBuffer: 16 * 1024 }).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') throw new AppError('unavailable', 'FFprobe indisponível para validar o vídeo.');

      throw new AppError('invalid', invalidVideo);
    });
    const stream = (JSON.parse(stdout) as { streams?: { width: number; height: number }[] }).streams?.[0];
    return { width: stream?.width ?? 0, height: stream?.height ?? 0 };
  }
}
