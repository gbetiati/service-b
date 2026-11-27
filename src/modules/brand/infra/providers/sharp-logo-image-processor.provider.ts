import { Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { AppError } from '@/shared/core/errors/app.error';
import { LogoImageProcessor } from '../../domain/providers/logo-image-processor.provider';

// PNG de até 1024 px no maior lado. Diferente das fotos de produto (JPEG sobre fundo branco), o logo mantém o fundo
// transparente, para ficar bem sobre a foto e sobre as cores da marca nos templates.
@Injectable()
export class SharpLogoImageProcessor implements LogoImageProcessor {
  async normalize (buffer: Buffer) {
    try {
      const image = sharp(buffer, { limitInputPixels: 24_000_000 });
      const { format } = await image.metadata();

      if (!format || !['jpeg', 'png', 'webp', 'svg'].includes(format)) throw new Error('Invalid image');

      return await image.rotate().resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true }).png({ compressionLevel: 9 }).toBuffer();
    } catch {
      throw new AppError('invalid', 'Envie o logo em PNG, JPEG, WebP ou SVG válido.');
    }
  }
}
