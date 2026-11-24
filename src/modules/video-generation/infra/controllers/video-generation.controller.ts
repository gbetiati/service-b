import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Authenticated } from '@/modules/identity/infra/guards/authenticated.decorator';
import { GenerateVideoUseCase } from '../../application/use-cases/generate-video.usecase';
import { GetVideoGenerationStatusUseCase } from '../../application/use-cases/get-video-generation-status.usecase';

@Controller()
@Authenticated()
export class VideoGenerationController {
  constructor(
    private readonly generateVideoUseCase: GenerateVideoUseCase,
    private readonly getVideoGenerationStatusUseCase: GetVideoGenerationStatusUseCase,
  ) {}

  @Post('contents/:id/video-generations')
  @HttpCode(202)
  generate (@Param('id', ParseUUIDPipe) id: string) {
    return this.generateVideoUseCase.execute(id);
  }

  @Get('contents/:id/video-generations')
  current (@Param('id', ParseUUIDPipe) id: string) {
    return this.getVideoGenerationStatusUseCase.executeForContent(id);
  }

  @Get('video-generations/:id')
  status (@Param('id', ParseUUIDPipe) id: string) {
    return this.getVideoGenerationStatusUseCase.execute(id);
  }
}
