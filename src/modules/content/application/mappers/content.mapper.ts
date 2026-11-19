import { Content } from '../../domain/entities/content.entity';

export class ContentMapper {
  static toResponse(content: Content)
  {
    const { fields, ...properties } = content;
    const { assets, ...rest } = fields;
    return { ...properties, ...rest, mediaAssetIds: assets.map(asset => asset.mediaAssetId) };
  }
}
