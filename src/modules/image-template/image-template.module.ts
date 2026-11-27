import { Module } from '@nestjs/common';
import { ListImageTemplatesUseCase } from './application/use-cases/list-image-templates.usecase';
import { ResetImageTemplateSettingUseCase } from './application/use-cases/reset-image-template-setting.usecase';
import { SaveImageTemplateSettingUseCase } from './application/use-cases/save-image-template-setting.usecase';
import { ImageTemplateSettingRepository } from './domain/repositories/image-template-setting.repository';
import { ImageTemplateController } from './infra/controllers/image-template.controller';
import { PrismaImageTemplateSettingRepository } from './infra/prisma/image-template-setting.prisma-repository';

// Configuração dos templates de foto por empresa: o tipo de foto (produto ou pessoa) preferido em cada cena.
@Module({
  controllers: [ImageTemplateController],
  providers: [
    ListImageTemplatesUseCase, ResetImageTemplateSettingUseCase, SaveImageTemplateSettingUseCase,
    { provide: ImageTemplateSettingRepository, useClass: PrismaImageTemplateSettingRepository },
  ],
  exports: [ImageTemplateSettingRepository],
})
export class ImageTemplateModule {}
