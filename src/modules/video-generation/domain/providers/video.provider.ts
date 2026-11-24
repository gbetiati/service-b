import type { Readable } from 'node:stream';
import type { ScriptBrief } from '@/modules/content/domain/providers/script.provider';
import type { RenderBrand, RenderProduct } from '../entities/video-generation.entity';

// `narrated: false` indica um vídeo sem fala: as etapas de transcrição e legendas ficam prontas sem texto.
export type RenderOutcome = { state: 'failed' } | { state: 'ready'; url: string; narrated?: boolean };
export type RenderResult = { submissionId: string; providerId: string; outcome: RenderOutcome };

export type RenderRequest = { submissionId: string; script: string; imageUrls: string[]; brand: RenderBrand; brief: ScriptBrief; product?: RenderProduct };

// O render é assíncrono: `render` devolve o ID no provedor e o resultado chega por webhook.
export abstract class VideoProvider {
  abstract render (input: RenderRequest): Promise<string>;

  abstract download (url: string): Promise<Readable>;
}
