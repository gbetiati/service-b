import React from 'react';
import { Composition } from 'remotion';
import type { ProductAdProps } from '../../src/modules/video-generation/domain/entities/product-ad';
import {
  PRODUCT_AD_DIMENSIONS, PRODUCT_AD_DURATION_IN_FRAMES, PRODUCT_AD_FORMATS, PRODUCT_AD_FPS, productAdCompositionId,
} from '../../src/modules/video-generation/infra/remotion/product-ad.compositions';
import { ProductAd } from './templates/ProductAd';

const defaultProps: ProductAdProps = {
  copy: {
    headline: 'Conforto para o dia todo',
    bullets: ['Tecido leve e respirável', 'Costura reforçada', 'Disponível em 4 cores'],
    cta: 'Compre agora',
  },
  product: { name: 'Camiseta Básica', price: 'R$ 79,90', oldPrice: 'R$ 99,90', imageUrl: 'https://picsum.photos/id/21/1200/1200' },
  brand: { primaryColor: '#2563eb' },
};

export const RemotionRoot: React.FC = () => (
  <>
    {PRODUCT_AD_FORMATS.map(format => (
      <Composition
        key={format}
        id={productAdCompositionId(format)}
        component={ProductAd}
        durationInFrames={PRODUCT_AD_DURATION_IN_FRAMES}
        fps={PRODUCT_AD_FPS}
        width={PRODUCT_AD_DIMENSIONS[format].width}
        height={PRODUCT_AD_DIMENSIONS[format].height}
        defaultProps={defaultProps}
      />
    ))}
  </>
);
