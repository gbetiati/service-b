import { Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { AppError } from '@/shared/core/errors/app.error';
import { ImageProcessorProvider } from '../../domain/providers/image-processor.provider';

@Injectable()
export class SharpImageProcessorProvider implements ImageProcessorProvider {
  async normalize(buffer: Buffer)
  {
    try {
      const image = sharp(buffer, { limitInputPixels: 24_000_000 });
      const { format } = await image.metadata();
      if (!format || !['jpeg', 'png', 'webp'].includes(format)) throw new Error('Invalid image');
      return await image.rotate().resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
        .flatten({ background: '#ffffff' }).jpeg({ quality: 90 }).toBuffer();
    } catch {
      throw new AppError('invalid', 'Envie um JPEG, PNG ou WebP válido de até 24 megapixels.');
    }
  }
}
