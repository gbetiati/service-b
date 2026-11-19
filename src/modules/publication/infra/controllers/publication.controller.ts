import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { TenantGuard } from '@/modules/identity/infra/guards/tenant.guard';
import { JwtAuthGuard } from '@/modules/identity/infra/jwt/jwt-auth.guard';
import { SchedulePublicationDto } from '../../application/dto/schedule-publication.dto';
import { GetPublicationUseCase } from '../../application/use-cases/get-publication.usecase';
import { SchedulePublicationUseCase } from '../../application/use-cases/schedule-publication.usecase';

@Controller('publications')
@UseGuards(JwtAuthGuard, TenantGuard)
export class PublicationController {
  constructor(
    private readonly schedulePublicationUseCase: SchedulePublicationUseCase,
    private readonly getPublicationUseCase: GetPublicationUseCase,
  ) {}

  @Post()
  schedule(@Body() dto: SchedulePublicationDto) {
    return this.schedulePublicationUseCase.execute(dto);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.getPublicationUseCase.execute(id);
  }
}
