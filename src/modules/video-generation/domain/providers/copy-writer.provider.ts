import type { ProductAdCopy } from '../entities/product-ad';

import type { BrandVoice } from '@/modules/content/domain/providers/script.provider';

// `script` é o roteiro do conteúdo, quando existe: a copy deve condensá-lo.
export type CopyBrief = BrandVoice & {
  name: string;
  description: string | null;
  brand: string | null;
  script?: string;
  image?: Buffer;
};

export abstract class CopyWriterProvider {
  abstract write (brief: CopyBrief): Promise<ProductAdCopy>;
}
