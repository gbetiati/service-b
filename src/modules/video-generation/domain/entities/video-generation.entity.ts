import { ScriptBrief } from '@/modules/content/domain/providers/script.provider';

export type VideoStatus = 'PENDING_SCRIPT' | 'SCRIPT_GENERATING' | 'PENDING' | 'SUBMITTING' | 'RENDERING' | 'READY' | 'FAILED';
export type RenderProduct = { name: string; description: string | null; price: string | null; oldPrice: string | null };

// Cores da marca usadas pelo template (o tom de voz já viaja no brief). A terceira e a quarta são opcionais porque gerações antigas foram salvas sem elas.
export type RenderBrand = { name: string; primaryColor: string | null; secondaryColor: string | null; tertiaryColor?: string | null; quaternaryColor?: string | null };

// `product` e `brand` são opcionais porque gerações antigas foram salvas sem eles.
export type RenderInput = { script: string; imageKeys: string[]; brief: ScriptBrief; product?: RenderProduct; brand?: RenderBrand };

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
