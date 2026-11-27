import { Injectable } from '@nestjs/common';
import { AppError, requireRecord } from '@/shared/core/errors/app.error';
import { ContentRepository } from '../../domain/repositories/content.repository';
import { ReviewContentDto } from '../dto/review-content.dto';

// Revisão humana do conteúdo: aprova ou reprova a revisão atual. Só conteúdo aprovado é publicado.
@Injectable()
export class ReviewContentUseCase {
  constructor(
    private readonly contentRepository: ContentRepository,
  ) {}

  async execute (id: string, { revision, approved }: ReviewContentDto) {
    const content = requireRecord(await this.contentRepository.findById(id), 'Conteúdo');
    content.assertReviewable(revision, approved);
    const reviewed = await this.contentRepository.setHumanApproval(id, revision, approved);

    if (!reviewed) throw new AppError('conflict', 'A revisão informada está desatualizada.');

    return reviewed;
  }
}
