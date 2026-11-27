import { Injectable } from '@nestjs/common';
import type { MediaAssetKind } from '@/modules/media-asset/domain/entities/media-asset-kind';
import { assertImageTemplate } from '../../domain/entities/image-template-setting';
import { ImageTemplateSettingRepository } from '../../domain/repositories/image-template-setting.repository';

// Salva o tipo de foto preferido em cada cena do template. Vale para os próximos vídeos gerados com ele.
@Injectable()
export class SaveImageTemplateSettingUseCase {
  constructor(
    private readonly settings: ImageTemplateSettingRepository,
  ) {}

  async execute (template: string, slotKinds: MediaAssetKind[]) {
    return this.settings.save(assertImageTemplate(template), slotKinds);
  }
}
