import type { Readable } from 'node:stream';
import type { RenderProduct } from '../entities/video-generation.entity';

// `narrated: false` indica um vídeo sem fala, que dispensa transcrição e legendas.
export type RenderOutcome = { state: 'failed' } | { state: 'ready'; url: string; narrated?: boolean };
export type RenderResult = { submissionId: string; providerId: string; outcome: RenderOutcome };

// Cada provedor usa o que precisa: roteiro e fotos (Creatomate, Replicate) ou dados do produto (Remotion).
export type RenderRequest = { submissionId: string; script: string; imageUrls: string[]; brand: string; product?: RenderProduct };

export const VIDEO_RENDER_PROVIDER = Symbol('VIDEO_RENDER_PROVIDER');

// O render é assíncrono: `render` devolve o ID no provedor e o resultado chega por webhook.
export abstract class VideoProvider {
  abstract render (input: RenderRequest): Promise<string>;

  abstract download (url: string): Promise<Readable>;
}
