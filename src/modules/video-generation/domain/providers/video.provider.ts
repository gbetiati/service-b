import type { Readable } from 'node:stream';

export type RenderStatus = { state: 'pending' } | { state: 'failed' } | { state: 'ready'; url: string };

export abstract class VideoProvider {
  abstract render(input: { script: string; imageUrls: string[] }): Promise<string>;
  abstract status(id: string): Promise<RenderStatus>;
  abstract download(url: string): Promise<Readable>;
}
