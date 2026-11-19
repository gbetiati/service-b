import { MediaAsset } from '../entities/media-asset.entity';

export abstract class MediaAssetRepository {
  abstract create (asset: MediaAsset): Promise<MediaAsset>;

  abstract findById (id: string): Promise<MediaAsset | null>;

  abstract findByProduct (productId: string): Promise<MediaAsset[]>;

  abstract findByIds (ids: string[]): Promise<MediaAsset[]>;
}
