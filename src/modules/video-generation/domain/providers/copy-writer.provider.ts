import type { ProductAdCopy } from '../entities/product-ad';

import type { BrandVoice } from '@/modules/content/domain/providers/script.provider';

// `script` é o roteiro do conteúdo, quando existe: a copy deve condensá-lo. `video` marca o anúncio montado com vídeos reais.
export type CopyContext = BrandVoice & {
  name: string;
  description: string | null;
  brand: string | null;
  script?: string;
  image?: Buffer;
  video?: boolean;
};

export abstract class CopyWriterProvider {
  abstract write (context: CopyContext): Promise<ProductAdCopy>;
}
