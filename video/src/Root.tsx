import React from 'react';
import { Composition } from 'remotion';
import type { ProductAdProps, VideoAdProps } from '../../src/modules/video-generation/domain/entities/product-ad';
import {
  PRODUCT_AD_DIMENSIONS, PRODUCT_AD_DURATION_IN_FRAMES, PRODUCT_AD_FORMATS, PRODUCT_AD_FPS, PRODUCT_AD_TEMPLATES, VIDEO_AD_TEMPLATES, productAdCompositionId,
} from '../../src/modules/video-generation/infra/remotion/product-ad.compositions';
import type { ProductAdTemplate, VideoAdTemplate } from '../../src/modules/video-generation/infra/remotion/product-ad.compositions';
import { ProductAdMontage } from './templates/image-templates/ProductAdMontage';
import { ProductAdNative } from './templates/image-templates/ProductAdNative';
import { ProductAdReveal } from './templates/image-templates/ProductAdReveal';
import { ProductAdStory } from './templates/image-templates/ProductAdStory';
import { VideoAdCaptions } from './templates/video-templates/VideoAdCaptions';
import { VideoAdOneTake } from './templates/video-templates/VideoAdOneTake';
import { VideoAdResultFirst } from './templates/video-templates/VideoAdResultFirst';

const components: Record<ProductAdTemplate, React.FC<ProductAdProps>> = {
  ProductAdStory, ProductAdReveal, ProductAdNative, ProductAdMontage,
};

const videoComponents: Record<VideoAdTemplate, React.FC<VideoAdProps>> = { VideoAdResultFirst, VideoAdOneTake, VideoAdCaptions };

const defaultProps: ProductAdProps = {
  copy: {
    headline: 'Conforto para o dia todo',
    bullets: ['Tecido leve e respirável', 'Costura reforçada', 'Disponível em 4 cores'],
    cta: 'Compre agora',
  },
  product: {
    name: 'Camiseta Básica', price: 'R$ 79,90', oldPrice: 'R$ 99,90', imageUrl: 'https://picsum.photos/id/21/1200/1200',
    imageUrls: ['https://picsum.photos/id/21/1200/1200', 'https://picsum.photos/id/96/1200/1200', 'https://picsum.photos/id/250/1200/1200'],
  },
  brand: { primaryColor: '#2563eb', secondaryColor: '#f59e0b' },
};

// Props de exemplo dos templates de vídeo no Studio. Troque `clips` por URLs de vídeos reais (com a duração de cada um)
// pelo painel de props do Studio ou por --props na CLI.
const videoDefaultProps: VideoAdProps = {
  copy: {
    headline: 'Vidro manchado de novo?',
    bullets: ['Vidros brilhando, sem marcas', 'Equipe preparada para altura', 'Atendimento sob medida'],
    cta: 'Peça seu orçamento',
  },
  product: { name: 'Limpeza de vidros' },
  brand: { name: 'Sua marca', primaryColor: '#0e7490', secondaryColor: '#facc15' },
  clips: [{ src: 'https://example.com/troque-por-um-video.mp4', durationInSeconds: 8 }],
};

export const RemotionRoot: React.FC = () => (
  <>
    {PRODUCT_AD_TEMPLATES.flatMap(template => PRODUCT_AD_FORMATS.map(format => (
      <Composition
        key={productAdCompositionId(format, template)}
        id={productAdCompositionId(format, template)}
        component={components[template]}
        durationInFrames={PRODUCT_AD_DURATION_IN_FRAMES}
        fps={PRODUCT_AD_FPS}
        width={PRODUCT_AD_DIMENSIONS[format].width}
        height={PRODUCT_AD_DIMENSIONS[format].height}
        defaultProps={defaultProps}
      />
    )))}
    {VIDEO_AD_TEMPLATES.flatMap(template => PRODUCT_AD_FORMATS.map(format => (
      <Composition
        key={productAdCompositionId(format, template)}
        id={productAdCompositionId(format, template)}
        component={videoComponents[template]}
        durationInFrames={PRODUCT_AD_DURATION_IN_FRAMES}
        fps={PRODUCT_AD_FPS}
        width={PRODUCT_AD_DIMENSIONS[format].width}
        height={PRODUCT_AD_DIMENSIONS[format].height}
        defaultProps={videoDefaultProps}
      />
    )))}
  </>
);
