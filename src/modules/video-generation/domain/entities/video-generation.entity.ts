import { ScriptBrief } from '@/modules/content/domain/providers/script.provider';

export type VideoStatus = 'PENDING' | 'SUBMITTING' | 'RENDERING' | 'READY' | 'FAILED';
export type RenderInput = { script: string; imageKeys: string[]; brief: ScriptBrief };

export type VideoGeneration = {
  id: string; companyId: string; contentId: string; revision: number; input: RenderInput; status: VideoStatus;
  providerId: string | null; error: string | null; leaseUntil: Date | null; createdAt: Date; updatedAt: Date;
};
