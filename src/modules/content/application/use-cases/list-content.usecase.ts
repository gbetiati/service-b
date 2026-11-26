import { Injectable } from '@nestjs/common';
import { ContentRepository } from '../../domain/repositories/content.repository';
import { ListContentDto } from '../dto/list-content.dto';

@Injectable()
export class ListContentUseCase {
  constructor(
    private readonly contentRepository: ContentRepository,
  ) {}

  execute ({ offset, limit, search, productId, status }: ListContentDto) {
    return this.contentRepository.findAll(offset, limit, { search: search || undefined, productId, status });
  }
}
