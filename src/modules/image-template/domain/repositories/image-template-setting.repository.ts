import type { MediaAssetKind } from '@/modules/media-asset/domain/entities/media-asset-kind';
import type { ProductAdTemplate } from '@/modules/video-generation/infra/remotion/product-ad.compositions';
import type { ImageTemplateSetting } from '../entities/image-template-setting';

// Configurações dos templates de foto da empresa atual.
export abstract class ImageTemplateSettingRepository {
  abstract findAll (): Promise<ImageTemplateSetting[]>;

  abstract save (template: ProductAdTemplate, slotKinds: MediaAssetKind[]): Promise<ImageTemplateSetting>;

  // Volta o template à ordem padrão. Devolve false quando ele já não tinha configuração.
  abstract remove (template: ProductAdTemplate): Promise<boolean>;
}
