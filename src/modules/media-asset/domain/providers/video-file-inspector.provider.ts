export abstract class VideoFileInspector {
  abstract validateMp4 (file: Buffer): Promise<void>;
}
