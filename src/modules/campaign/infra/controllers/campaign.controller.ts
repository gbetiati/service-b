import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Authenticated } from '@/modules/identity/infra/guards/authenticated.decorator';
import { CreateCampaignDto } from '../../application/dto/create-campaign.dto';
import { CreateCampaignUseCase } from '../../application/use-cases/create-campaign.usecase';
import { GetCampaignUseCase } from '../../application/use-cases/get-campaign.usecase';
import { ListCampaignUseCase } from '../../application/use-cases/list-campaign.usecase';

@Controller('campaigns')
@Authenticated()
export class CampaignController {
  constructor(
    private readonly createCampaignUseCase: CreateCampaignUseCase,
    private readonly listCampaignUseCase: ListCampaignUseCase,
    private readonly getCampaignUseCase: GetCampaignUseCase,
  ) {}

  @Post()
  create (@Body() dto: CreateCampaignDto) {
    return this.createCampaignUseCase.execute(dto);
  }

  @Get()
  list () {
    return this.listCampaignUseCase.execute();
  }

  @Get(':id')
  get (@Param('id', ParseUUIDPipe) id: string) {
    return this.getCampaignUseCase.execute(id);
  }
}
