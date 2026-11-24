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

  static storageKeyFor (companyId: string, contentId: string, generationId: string) {
    return `${companyId}/contents/${contentId}/videos/${generationId}.mp4`;
  }

  static skippedReview (): VideoReview {
    return { status: ContentStatus.APPROVED, reason: 'Revisão automática dispensada por configuração.', ocr: [] };
  }
}
