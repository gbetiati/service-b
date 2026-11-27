import type { Readable } from 'node:stream';
import type { ContentAudio } from '@/modules/content/domain/entities/content.entity';
import type { ContentMediaType } from '@/modules/content/domain/entities/content-media-type';
import type { ScriptContext } from '@/modules/content/domain/providers/script.provider';
import type { AdImageKind } from '../entities/product-ad';
import type { RenderBrand, RenderProduct } from '../entities/video-generation.entity';

// `narrated: false` dispensa as etapas de transcrição e legendas: elas ficam prontas sem rodar. `transcript` é o texto
// falado, quando o provedor já o conhece (como a locução gerada a partir do roteiro); sem ele, a transcrição fica vazia.
// `template` é o template usado no render, que entra no nome do arquivo.
export type RenderOutcome = { state: 'failed' } | { state: 'ready'; url: string; narrated?: boolean; transcript?: string; template?: string };
export type RenderResult = { submissionId: string; providerId: string; outcome: RenderOutcome };

// `mediaUrls` são as URLs assinadas das fotos ou dos vídeos do conteúdo, conforme `mediaType`, na ordem escolhida.
// `mediaKinds` é o tipo de cada foto e `imageSlots`, o tipo preferido em cada cena por template de foto (configuração
// da empresa); o provedor distribui as fotos pelas cenas do template sorteado com ProductAdPolicy.arrangeImages.
export type RenderRequest = {
  submissionId: string; script: string; mediaUrls: string[]; mediaType: ContentMediaType;
  mediaKinds?: AdImageKind[]; imageSlots?: Partial<Record<string, AdImageKind[]>>;
  // Template escolhido; sem ele, sorteado entre os do tipo do conteúdo.
  template?: string;
  // URL assinada do logo da marca, quando ela tem.
  logoUrl?: string;
  brand: RenderBrand; context: ScriptContext; product?: RenderProduct; audio?: ContentAudio;
};

// O render é assíncrono: `render` devolve o ID no provedor e o resultado chega por webhook.
export abstract class VideoProvider {
  abstract render (input: RenderRequest): Promise<string>;

  abstract download (url: string): Promise<Readable>;
}
