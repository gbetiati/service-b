import { Injectable } from '@nestjs/common';
import { PRODUCT_AD_TEMPLATES } from '@/modules/video-generation/infra/remotion/product-ad.compositions';
import { ImageTemplateSettingRepository } from '../../domain/repositories/image-template-setting.repository';

// Todos os templates de foto, com a configuração da empresa quando existe (`slotKinds: null` = ordem padrão).
@Injectable()
export class ListImageTemplatesUseCase {
  constructor(
    private readonly settings: ImageTemplateSettingRepository,
  ) {}

  async execute () {
    const saved = await this.settings.findAll();
    return PRODUCT_AD_TEMPLATES.map(template => {
      const setting = saved.find(item => item.template === template);
      return { template, slotKinds: setting?.slotKinds ?? null, updatedAt: setting?.updatedAt ?? null };
    });
  }
}
