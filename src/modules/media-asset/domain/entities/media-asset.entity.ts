import { randomUUID } from 'node:crypto';

export type MediaAssetContentType = 'image/jpeg' | 'video/mp4';

export class MediaAsset {
  constructor(
    readonly id: string,
    readonly companyId: string,
    readonly productId: string,
    readonly storageKey: string,
    readonly contentType: string,
    readonly bytes: number,
    readonly createdAt: Date,
    readonly updatedAt: Date,
  ) {}

  static create (companyId: string, productId: string, bytes: number, contentType: MediaAssetContentType = 'image/jpeg') {
    const id = randomUUID();
    const now = new Date();
    const extension = contentType === 'video/mp4' ? 'mp4' : 'jpg';
    return new MediaAsset(id, companyId, productId, `${companyId}/products/${productId}/${id}.${extension}`, contentType, bytes, now, now);
  }

  // Considera vídeo quando o cliente declara um MIME de vídeo ou quando o arquivo tem a assinatura ISO BMFF ("ftyp").
  static isVideoUpload (file: Buffer, mimeType?: string) {
    return !!mimeType?.startsWith('video/') || file.toString('ascii', 4, 8) === 'ftyp';
  }

  get isImage () {
    return this.contentType.startsWith('image/');
  }
}
