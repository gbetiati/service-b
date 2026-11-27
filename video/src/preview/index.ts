// Entrada de prévia para outros apps (a página /templates do ag-frontend): o Player do Remotion e os templates de foto,
// exportados daqui para que tudo resolva `remotion` a partir deste projeto. Com uma cópia só do Remotion, os templates
// enxergam o contexto do player (frame, duração); com duas, quebrariam. O Studio e o render não usam este arquivo.
import type React from 'react';
import type { ProductAdProps } from '../../../src/modules/video-generation/domain/entities/product-ad';
import type { ProductAdTemplate } from '../../../src/modules/video-generation/infra/remotion/product-ad.compositions';
import { ProductAdMontage } from '../templates/image-templates/ProductAdMontage';
import { ProductAdNative } from '../templates/image-templates/ProductAdNative';
import { ProductAdReveal } from '../templates/image-templates/ProductAdReveal';
import { ProductAdStory } from '../templates/image-templates/ProductAdStory';

export { Player } from '@remotion/player';

export const IMAGE_TEMPLATE_COMPONENTS: Record<ProductAdTemplate, React.FC<ProductAdProps>> = {
  ProductAdStory, ProductAdReveal, ProductAdNative, ProductAdMontage,
};
