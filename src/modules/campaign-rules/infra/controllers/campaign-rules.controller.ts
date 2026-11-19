import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { TenantGuard } from '@/modules/identity/infra/guards/tenant.guard';
import { JwtAuthGuard } from '@/modules/identity/infra/jwt/jwt-auth.guard';
import { CreateCampaignRulesDto } from '../../application/dto/create-campaign-rules.dto';
import { CreateCampaignRulesUseCase } from '../../application/use-cases/create-campaign-rules.usecase';
import { GetCampaignRulesUseCase } from '../../application/use-cases/get-campaign-rules.usecase';
import { ListCampaignRulesUseCase } from '../../application/use-cases/list-campaign-rules.usecase';

@Controller('campaign-rules')
@UseGuards(JwtAuthGuard, TenantGuard)
export class CampaignRulesController {
  constructor(
    private readonly createCampaignRulesUseCase: CreateCampaignRulesUseCase,
    private readonly listCampaignRulesUseCase: ListCampaignRulesUseCase,
    private readonly getCampaignRulesUseCase: GetCampaignRulesUseCase,
  ) {}

  @Post()
  create(@Body() dto: CreateCampaignRulesDto) {
    return this.createCampaignRulesUseCase.execute(dto);
  }

  @Get()
  list() {
    return this.listCampaignRulesUseCase.execute();
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.getCampaignRulesUseCase.execute(id);
  }
}
