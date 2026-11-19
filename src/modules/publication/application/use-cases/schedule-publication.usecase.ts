import { Injectable } from '@nestjs/common';
import { PublicationRepository } from '../../domain/repositories/publication.repository';
import { SchedulePublicationDto } from '../dto/schedule-publication.dto';

@Injectable()
export class SchedulePublicationUseCase {
  constructor(
    private readonly publicationRepository: PublicationRepository,
  ) {}
  execute(dto: SchedulePublicationDto)
  { return this.publicationRepository.create({ ...dto, date: new Date(dto.date) }); }
}
