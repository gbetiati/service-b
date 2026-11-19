import type { Readable } from 'node:stream';

export type RenderOutcome = { state: 'failed' } | { state: 'ready'; url: string };
export type RenderNotification = { submissionId: string; providerId: string; outcome: RenderOutcome };

export abstract class VideoProvider {
  abstract render(input: { submissionId: string; script: string; imageUrls: string[] }): Promise<string>;
  abstract download(url: string): Promise<Readable>;
}
