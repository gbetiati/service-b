export abstract class VideoSubtitlesProvider {
  abstract burn (storageKey: string, srt: string): Promise<string>;
}
