import { Injectable } from '@nestjs/common';
import { requireRecord } from '@/shared/core/errors/app.error';
import { ContentRepository } from '../../domain/repositories/content.repository';
import { ContentPageDto } from '../dto/content-page.dto';

@Injectable()
export class GetContentHistoryUseCase {
  constructor(
    private readonly contentRepository: ContentRepository,
  ) {}
  async execute(id: string, page: ContentPageDto)
  {
    requireRecord(await this.contentRepository.findById(id), 'Conteúdo');
    return this.contentRepository.findHistory(id, page.offset, page.limit);
  }
}
