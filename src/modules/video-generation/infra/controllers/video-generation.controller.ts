import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { TenantGuard } from '@/modules/identity/infra/guards/tenant.guard';
import { JwtAuthGuard } from '@/modules/identity/infra/jwt/jwt-auth.guard';
import { GenerateVideoUseCase } from '../../application/use-cases/generate-video.usecase';
import { GetVideoGenerationStatusUseCase } from '../../application/use-cases/get-video-generation-status.usecase';

@Controller()
@UseGuards(JwtAuthGuard, TenantGuard)
export class VideoGenerationController {
  constructor(
    private readonly generateVideoUseCase: GenerateVideoUseCase,
    private readonly getVideoGenerationStatusUseCase: GetVideoGenerationStatusUseCase,
  ) { }

  @Post('contents/:id/video-generations')
  @HttpCode(202)
  generate(@Param('id', ParseUUIDPipe) id: string) {
    return this.generateVideoUseCase.execute(id);
  }

  @Get('video-generations/:id')
  status(@Param('id', ParseUUIDPipe) id: string) {
    return this.getVideoGenerationStatusUseCase.execute(id);
  }
}
