import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Authenticated } from '@/modules/identity/infra/guards/authenticated.decorator';
import { CreateContentDto } from '../../application/dto/create-content.dto';
import { UpdateContentDto } from '../../application/dto/update-content.dto';
import { ReviewContentDto } from '../../application/dto/review-content.dto';
import { ContentPageDto } from '../../application/dto/content-page.dto';
import { ListContentDto } from '../../application/dto/list-content.dto';
import { ContentMapper } from '../../application/mappers/content.mapper';
import { CreateContentUseCase } from '../../application/use-cases/create-content.usecase';
import { DeleteContentUseCase } from '../../application/use-cases/delete-content.usecase';
import { UpdateContentUseCase } from '../../application/use-cases/update-content.usecase';
import { GetContentDetailsUseCase } from '../../application/use-cases/get-content-details.usecase';
import { GetContentHistoryUseCase } from '../../application/use-cases/get-content-history.usecase';
import { ListContentUseCase } from '../../application/use-cases/list-content.usecase';
import { ReviewContentUseCase } from '../../application/use-cases/review-content.usecase';

@Controller('contents')
@Authenticated()
export class ContentController {
  constructor(
    private readonly createContentUseCase: CreateContentUseCase,
    private readonly updateContentUseCase: UpdateContentUseCase,
    private readonly getContentDetailsUseCase: GetContentDetailsUseCase,
    private readonly getContentHistoryUseCase: GetContentHistoryUseCase,
    private readonly listContentUseCase: ListContentUseCase,
    private readonly deleteContentUseCase: DeleteContentUseCase,
    private readonly reviewContentUseCase: ReviewContentUseCase,
  ) {}

  @Post()
  async create (@Body() dto: CreateContentDto) {
    return ContentMapper.toResponse(await this.createContentUseCase.execute(dto));
  }

  @Patch(':id')
  async update (@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateContentDto) {
    return ContentMapper.toResponse(await this.updateContentUseCase.execute(id, dto));
  }

  // Revisão humana: aprova ou reprova a revisão atual do conteúdo.
  @Patch(':id/approval')
  async review (@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewContentDto) {
    return ContentMapper.toResponse(await this.reviewContentUseCase.execute(id, dto));
  }

  @Delete(':id')
  @HttpCode(204)
  async delete (@Param('id', ParseUUIDPipe) id: string) {
    await this.deleteContentUseCase.execute(id);
  }

  @Get()
  async list (@Query() query: ListContentDto) {
    return (await this.listContentUseCase.execute(query)).map(ContentMapper.toResponse);
  }

  @Get(':id')
  async get (@Param('id', ParseUUIDPipe) id: string) {
    return ContentMapper.toResponse(await this.getContentDetailsUseCase.execute(id));
  }

  @Get(':id/history')
  history (@Param('id', ParseUUIDPipe) id: string, @Query() page: ContentPageDto) {
    return this.getContentHistoryUseCase.execute(id, page);
  }
}
