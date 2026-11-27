import { Injectable } from '@nestjs/common';
import { assertImageTemplate } from '../../domain/entities/image-template-setting';
import { ImageTemplateSettingRepository } from '../../domain/repositories/image-template-setting.repository';

// Volta o template à ordem padrão (as fotos na ordem escolhida no conteúdo). Repetir não muda nada.
@Injectable()
export class ResetImageTemplateSettingUseCase {
  constructor(
    private readonly settings: ImageTemplateSettingRepository,
  ) {}

  async execute (template: string) {
    await this.settings.remove(assertImageTemplate(template));
  }
}
