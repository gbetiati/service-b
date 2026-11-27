import { MediaAsset } from '../entities/media-asset.entity';
import type { MediaAssetKind } from '../entities/media-asset-kind';

export abstract class MediaAssetRepository {
  abstract create (asset: MediaAsset): Promise<MediaAsset>;

  abstract findById (id: string): Promise<MediaAsset | null>;

  abstract findByProduct (productId: string): Promise<MediaAsset[]>;

  // Muda o tipo da mídia na empresa atual. Devolve null se ela não existir.
  abstract updateKind (id: string, kind: MediaAssetKind): Promise<MediaAsset | null>;
}
