import { Injectable } from '@nestjs/common';
import { AppError } from '@/shared/core/errors/app.error';
import { ContentScheduleRepository } from '../../domain/repositories/content-schedule.repository';
import type { ListPublicationSchedulesDto } from '../dto/list-publication-schedules.dto';

const MAX_RANGE_MS = 32 * 24 * 60 * 60 * 1000;

@Injectable()
export class ListPublicationSchedulesUseCase {
  constructor(private readonly contentScheduleRepository: ContentScheduleRepository) {}

  execute (query: ListPublicationSchedulesDto) {
    const from = new Date(query.from);
    const to = new Date(query.to);
    const duration = to.getTime() - from.getTime();

    if (!(duration > 0 && duration <= MAX_RANGE_MS)) {
      throw new AppError('invalid', 'Informe um intervalo de agendamento válido de até 32 dias.');
    }

    return this.contentScheduleRepository.findByDateRange(from, to, { productId: query.productId, status: query.status });
  }
}
