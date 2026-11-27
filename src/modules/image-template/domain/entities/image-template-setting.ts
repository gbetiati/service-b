import { AppError } from '@/shared/core/errors/app.error';
import { MediaAssetKind } from '@/modules/media-asset/domain/entities/media-asset-kind';
import { PRODUCT_AD_TEMPLATES, ProductAdTemplate } from '@/modules/video-generation/infra/remotion/product-ad.compositions';
import { PRODUCT_AD_MAX_IMAGES } from '@/modules/video-generation/domain/entities/product-ad';

// Cenas de um template de foto, uma por foto: abertura, benefícios e fechamento (preço e CTA).
export const IMAGE_TEMPLATE_SLOTS = PRODUCT_AD_MAX_IMAGES;

// Configuração de um template de foto na empresa: o tipo de foto preferido em cada cena. Sem configuração, as fotos
// entram nas cenas na ordem escolhida no conteúdo.
export type ImageTemplateSetting = { template: ProductAdTemplate; slotKinds: MediaAssetKind[]; updatedAt: Date };

export function assertImageTemplate (template: string): ProductAdTemplate {
  const known = PRODUCT_AD_TEMPLATES.find(name => name === template);

  if (!known) throw new AppError('missing', 'Template de foto não encontrado.');

  return known;
}
