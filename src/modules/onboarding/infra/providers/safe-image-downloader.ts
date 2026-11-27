import { Injectable } from '@nestjs/common';
import { safeFetch } from '@/shared/libs/http/safe-fetch';
import { RemoteImageDownloader } from '../../domain/providers/remote-image-downloader';

// Imagem pública com as mesmas proteções da leitura do site: só endereços públicos, até 5 MB e só imagens.
@Injectable()
export class SafeImageDownloader implements RemoteImageDownloader {
  async download (url: string) {
    return (await safeFetch(url, { accept: /^image\//, maxBytes: 5 * 1024 * 1024 })).body;
  }
}
