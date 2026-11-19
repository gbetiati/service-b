import { Injectable } from '@nestjs/common';
import { ContentRepository } from '../../domain/repositories/content.repository';
import { ContentPageDto } from '../dto/content-page.dto';

@Injectable()
export class ListContentUseCase {
  constructor(
    private readonly contentRepository: ContentRepository,
  ) {}

  execute (page: ContentPageDto) {
    return this.contentRepository.findAll(page.offset, page.limit);
  }
}
