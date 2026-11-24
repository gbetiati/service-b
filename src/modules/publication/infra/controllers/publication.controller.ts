import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { TenantGuard } from '@/modules/identity/infra/guards/tenant.guard';
import { JwtAuthGuard } from '@/modules/identity/infra/jwt/jwt-auth.guard';
import { CreateScheduledPublicationDto } from '../../application/dto/create-scheduled-publication.dto';
import { PreparePublicationDto } from '../../application/dto/prepare-publication.dto';
import { SchedulePublicationDto } from '../../application/dto/schedule-publication.dto';
import { CreateScheduledPublicationUseCase } from '../../application/use-cases/create-scheduled-publication.usecase';
import { GetPublicationUseCase } from '../../application/use-cases/get-publication.usecase';
import { PublicationOrchestrator } from '../../application/use-cases/publication.orchestrator';
import { SchedulePublicationUseCase } from '../../application/use-cases/schedule-publication.usecase';

@Controller('publications')
@UseGuards(JwtAuthGuard, TenantGuard)
export class PublicationController {
  constructor(
    private readonly schedulePublicationUseCase: SchedulePublicationUseCase,
    private readonly getPublicationUseCase: GetPublicationUseCase,
    private readonly publicationOrchestrator: PublicationOrchestrator,
    private readonly createScheduledPublicationUseCase: CreateScheduledPublicationUseCase,
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

  @Get('schedules/:id')
  getSchedule (@Param('id', ParseUUIDPipe) id: string) {
    return this.getPublicationUseCase.schedule(id);
  }

  @Get(':id')
  get (@Param('id', ParseUUIDPipe) id: string) {
    return this.getPublicationUseCase.execute(id);
  }
}
