import { Body, Controller, Delete, Get, HttpCode, Param, Put } from '@nestjs/common';
import { Authenticated } from '@/modules/identity/infra/guards/authenticated.decorator';
import { SaveImageTemplateSettingDto } from '../../application/dto/save-image-template-setting.dto';
import { ListImageTemplatesUseCase } from '../../application/use-cases/list-image-templates.usecase';
import { ResetImageTemplateSettingUseCase } from '../../application/use-cases/reset-image-template-setting.usecase';
import { SaveImageTemplateSettingUseCase } from '../../application/use-cases/save-image-template-setting.usecase';

@Controller('image-templates')
@Authenticated()
export class ImageTemplateController {
  constructor(
    private readonly listImageTemplatesUseCase: ListImageTemplatesUseCase,
    private readonly saveImageTemplateSettingUseCase: SaveImageTemplateSettingUseCase,
    private readonly resetImageTemplateSettingUseCase: ResetImageTemplateSettingUseCase,
  ) {}

  @Get()
  list () {
    return this.listImageTemplatesUseCase.execute();
  }

  @Put(':template')
  save (@Param('template') template: string, @Body() dto: SaveImageTemplateSettingDto) {
    return this.saveImageTemplateSettingUseCase.execute(template, dto.slotKinds);
  }

  @Delete(':template')
  @HttpCode(204)
  async reset (@Param('template') template: string) {
    await this.resetImageTemplateSettingUseCase.execute(template);
  }
}
