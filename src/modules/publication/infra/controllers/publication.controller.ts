import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Authenticated } from '@/modules/identity/infra/guards/authenticated.decorator';
import { CreateScheduledPublicationDto } from '../../application/dto/create-scheduled-publication.dto';
import { ListPublicationSchedulesDto } from '../../application/dto/list-publication-schedules.dto';
import { PreparePublicationDto } from '../../application/dto/prepare-publication.dto';
import { SchedulePublicationDto } from '../../application/dto/schedule-publication.dto';
import { CreateScheduledPublicationUseCase } from '../../application/use-cases/create-scheduled-publication.usecase';
import { GetPublicationScheduleUseCase } from '../../application/use-cases/get-publication-schedule.usecase';
import { GetPublicationUseCase } from '../../application/use-cases/get-publication.usecase';
import { ListPublicationSchedulesUseCase } from '../../application/use-cases/list-publication-schedules.usecase';
import { PublicationOrchestrator } from '../../application/use-cases/publication.orchestrator';
import { SchedulePublicationUseCase } from '../../application/use-cases/schedule-publication.usecase';

@Controller('publications')
@Authenticated()
export class PublicationController {
  constructor(
    private readonly schedulePublicationUseCase: SchedulePublicationUseCase,
    private readonly getPublicationUseCase: GetPublicationUseCase,
    private readonly getPublicationScheduleUseCase: GetPublicationScheduleUseCase,
    private readonly publicationOrchestrator: PublicationOrchestrator,
    private readonly createScheduledPublicationUseCase: CreateScheduledPublicationUseCase,
    private readonly listPublicationSchedulesUseCase: ListPublicationSchedulesUseCase,
  ) {}

  @Post()
  schedule (@Body() dto: SchedulePublicationDto) {
    return this.schedulePublicationUseCase.execute(dto);
  }

  @Post('schedule')
  createScheduled (@Body() dto: CreateScheduledPublicationDto) {
    return this.createScheduledPublicationUseCase.execute(dto);
  }

  @Post('contents/:contentId/prepare')
  @HttpCode(202)
  prepare (@Param('contentId', ParseUUIDPipe) contentId: string, @Body() dto?: PreparePublicationDto) {
    return this.publicationOrchestrator.start(contentId, dto?.regenerateFromRevision);
  }

  @Get('schedules')
  listSchedules (@Query() query: ListPublicationSchedulesDto) {
    return this.listPublicationSchedulesUseCase.execute(query);
  }

  @Get('schedules/:id')
  getSchedule (@Param('id', ParseUUIDPipe) id: string) {
    return this.getPublicationScheduleUseCase.execute(id);
  }

  @Get(':id')
  get (@Param('id', ParseUUIDPipe) id: string) {
    return this.getPublicationUseCase.execute(id);
  }
}
