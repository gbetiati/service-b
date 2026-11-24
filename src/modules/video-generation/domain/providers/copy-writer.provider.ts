import type { ProductAdCopy } from '../entities/product-ad';

export type CopyBrief = {
  name: string;
  description: string | null;
  brand: string | null;
  image?: Buffer;
};

export abstract class CopyWriterProvider {
  abstract write (brief: CopyBrief): Promise<ProductAdCopy>;
}
