import { Injectable } from '@nestjs/common';
import { requireRecord } from '@/shared/core/errors/app.error';
import { ContentRepository } from '../../domain/repositories/content.repository';
import { UpdateContentDto } from '../dto/update-content.dto';

@Injectable()
export class UpdateContentUseCase {
  constructor(
    private readonly contentRepository: ContentRepository,
  ) {}

  async execute (id: string, dto: UpdateContentDto, preparePublication = false) {
    const current = requireRecord(await this.contentRepository.findById(id), 'Conteúdo');
    current.assertRevision(dto.revision);
    const content = current.reviseWith(dto);
    content.validateReferences(await this.contentRepository.findReferences(content));
    return this.contentRepository.update(content, preparePublication);
  }
}
