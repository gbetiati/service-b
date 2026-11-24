import { Injectable } from '@nestjs/common';
import { requireRecord } from '@/shared/core/errors/app.error';
import { ContentScheduleRepository } from '../../domain/repositories/content-schedule.repository';

@Injectable()
export class GetPublicationScheduleUseCase {
  constructor(
    private readonly contentScheduleRepository: ContentScheduleRepository,
  ) {}

  async execute (id: string) {
    return requireRecord(await this.contentScheduleRepository.findById(id), 'Agendamento');
  }
}
