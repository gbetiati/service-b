import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/identity/infra/jwt/jwt-auth.guard';
import { TenantGuard } from '@/modules/identity/infra/guards/tenant.guard';
import { CreateContentDto } from '../../application/dto/create-content.dto';
import { UpdateContentDto } from '../../application/dto/update-content.dto';
import { ContentPageDto } from '../../application/dto/content-page.dto';
import { ContentMapper } from '../../application/mappers/content.mapper';
import { CreateContentUseCase } from '../../application/use-cases/create-content.usecase';
import { UpdateContentUseCase } from '../../application/use-cases/update-content.usecase';
import { GetContentDetailsUseCase } from '../../application/use-cases/get-content-details.usecase';
import { GetContentHistoryUseCase } from '../../application/use-cases/get-content-history.usecase';
import { ListContentUseCase } from '../../application/use-cases/list-content.usecase';

@Controller('contents')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ContentController {
  constructor(
    private readonly createContentUseCase: CreateContentUseCase,
    private readonly updateContentUseCase: UpdateContentUseCase,
    private readonly getContentDetailsUseCase: GetContentDetailsUseCase,
    private readonly getContentHistoryUseCase: GetContentHistoryUseCase,
    private readonly listContentUseCase: ListContentUseCase,
  ) { }

  @Post()
  async create (@Body() dto: CreateContentDto) {
    return ContentMapper.toResponse(await this.createContentUseCase.execute(dto));
  }

  @Patch(':id')
  async update (@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateContentDto) {
    return ContentMapper.toResponse(await this.updateContentUseCase.execute(id, dto));
  }

  @Get()
  async list (@Query() page: ContentPageDto) {
    return (await this.listContentUseCase.execute(page)).map(ContentMapper.toResponse);
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
