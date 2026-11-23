import { Injectable } from '@nestjs/common';
import { requireRecord } from '@/shared/core/errors/app.error';
import { ContentScheduleRepository } from '../../domain/repositories/content-schedule.repository';
import { PublicationRepository } from '../../domain/repositories/publication.repository';

@Injectable()
export class GetPublicationUseCase {
  constructor(
    private readonly publicationRepository: PublicationRepository,
    private readonly contentScheduleRepository: ContentScheduleRepository,
  ) {}

  async schedule (id: string) {
    return requireRecord(await this.contentScheduleRepository.findById(id), 'Agendamento');
  }

  async execute (id: string) {
    return requireRecord(await this.publicationRepository.findById(id), 'Publicação');
  }
}
