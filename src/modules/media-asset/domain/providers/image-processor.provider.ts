export abstract class ImageProcessorProvider {
  abstract normalize(input: Buffer): Promise<Buffer>;
}
