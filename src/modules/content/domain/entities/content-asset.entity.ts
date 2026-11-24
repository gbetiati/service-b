export class ContentAsset {
  constructor(
    readonly position: number,
    readonly mediaAssetId: string,
  ) {}

  // A posição segue a ordem informada pelo cliente.
  static fromMediaAssetIds (mediaAssetIds: string[]) {
    return mediaAssetIds.map((id, position) => new ContentAsset(position, id));
  }
}
