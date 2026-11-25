import { ContentStatus } from '@/modules/content/domain/entities/content-status';

export type VideoReview = { status: ContentStatus.APPROVED | ContentStatus.REPROVED; reason: string; ocr: string[] };

export class VideoAsset {
  constructor(
    readonly id: string,
    readonly companyId: string,
    readonly contentId: string,
    readonly generationId: string,
    readonly revision: number,
    readonly storageKey: string,
    readonly review: VideoReview,
  ) {}

  // Nome do arquivo: número sequencial com 5 dígitos, template usado (quando conhecido) e ID da geração, para os arquivos
  // ficarem fáceis de localizar e ordenar no bucket. Ex.: <empresa>/contents/<conteúdo>/videos/00042-ProductAdChecklist-<id>.mp4
  static storageKeyFor (companyId: string, contentId: string, generationId: string, file?: { number: number; template?: string }) {
    const template = file?.template && /^[A-Za-z0-9]{1,60}$/.test(file.template) ? file.template : undefined;
    const name = file ? [String(file.number).padStart(5, '0'), template, generationId].filter(Boolean).join('-') : generationId;
    return `${companyId}/contents/${contentId}/videos/${name}.mp4`;
  }

  static skippedReview (): VideoReview {
    return { status: ContentStatus.APPROVED, reason: 'Revisão automática dispensada por configuração.', ocr: [] };
  }
}
