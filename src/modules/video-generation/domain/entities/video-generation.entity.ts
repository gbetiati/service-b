import type { ContentAudio } from '@/modules/content/domain/entities/content.entity';
import type { ContentMediaType } from '@/modules/content/domain/entities/content-media-type';
import { ScriptContext } from '@/modules/content/domain/providers/script.provider';
import type { AdImageKind } from './product-ad';

export type VideoStatus = 'PENDING_SCRIPT' | 'SCRIPT_GENERATING' | 'PENDING' | 'SUBMITTING' | 'RENDERING' | 'READY' | 'FAILED';
export type RenderProduct = { name: string; description: string | null; price: string | null; oldPrice: string | null };

// Cores da marca usadas pelo template (o tom de voz já viaja no contexto do roteiro). A terceira e a quarta são opcionais porque gerações antigas foram salvas sem elas.
// `logoStorageKey` é o logo da marca no storage (opcional: marcas sem logo e gerações antigas).
export type RenderBrand = { name: string; primaryColor: string | null; secondaryColor: string | null; tertiaryColor?: string | null; quaternaryColor?: string | null; logoStorageKey?: string | null };

// `context` é o contexto do roteiro (gerações antigas o salvaram como `brief`; o repositório converte na leitura).
// `product`, `brand` e `audio` são opcionais porque gerações antigas foram salvas sem eles (sem `audio`, o vídeo sai mudo).
// `mediaKeys` são as fotos ou os vídeos do conteúdo, conforme `mediaType` (gerações antigas: `imageKeys` e só fotos).
// `mediaKinds` traz o tipo de cada foto, na mesma ordem (gerações antigas não têm: todas contam como produto).
// `template` é o template escolhido na geração; sem ele, o provedor sorteia entre os do tipo do conteúdo.
export type RenderInput = { script: string; mediaKeys: string[]; mediaKinds?: AdImageKind[]; mediaType?: ContentMediaType; template?: string; context: ScriptContext; product?: RenderProduct; brand?: RenderBrand; audio?: ContentAudio };

export type VideoGeneration = {
  id: string;
  companyId: string;
  contentId: string;
  revision: number;
  input: RenderInput;
  status: VideoStatus;
  scriptSubmissionId: string | null
  submissionId: string | null
  providerId: string | null
  error: string | null
  leaseUntil: Date | null
  createdAt: Date
  updatedAt: Date
};
