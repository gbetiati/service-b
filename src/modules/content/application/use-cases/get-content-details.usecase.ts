import { Injectable } from '@nestjs/common';
import { requireRecord } from '@/shared/core/errors/app.error';
import { ContentRepository } from '../../domain/repositories/content.repository';

@Injectable()
export class GetContentDetailsUseCase {
  constructor(
    private readonly contentRepository: ContentRepository,
  ) {}

  async execute (id: string) {
    return requireRecord(await this.contentRepository.findById(id), 'Conteúdo');
  }
}
