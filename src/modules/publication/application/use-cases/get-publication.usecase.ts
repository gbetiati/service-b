import { Injectable } from '@nestjs/common';
import { requireRecord } from '@/shared/core/errors/app.error';
import { PublicationRepository } from '../../domain/repositories/publication.repository';

@Injectable()
export class GetPublicationUseCase {
  constructor(
    private readonly publicationRepository: PublicationRepository,
  ) {}
  async execute(id: string)
  { return requireRecord(await this.publicationRepository.findById(id), 'Publicação'); }
}
