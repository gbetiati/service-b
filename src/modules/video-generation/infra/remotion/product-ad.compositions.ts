// Composições registradas no projeto Remotion (video/src/Root.tsx importa este arquivo).
// Mantenha este arquivo sem imports: ele também é lido pelo bundler do Remotion.

export const PRODUCT_AD_FORMATS = ['9x16', '1x1', '16x9'] as const;

export type ProductAdFormat = (typeof PRODUCT_AD_FORMATS)[number];

export const PRODUCT_AD_FPS = 30;
export const PRODUCT_AD_DURATION_IN_FRAMES = 360;

export const PRODUCT_AD_DIMENSIONS: Record<ProductAdFormat, { width: number; height: number }> = {
  '9x16': { width: 1080, height: 1920 },
  '1x1': { width: 1080, height: 1080 },
  '16x9': { width: 1920, height: 1080 },
};

// Templates do anúncio. Todos recebem as mesmas props (ProductAdProps) e têm a mesma duração e os mesmos formatos.
// - ProductAd: foto em tela cheia, headline sobre degradê e cenas com a foto desfocada.
// - ProductAdEditorial: estilo revista, fundo na cor principal, foto em cartão e benefícios numerados.
// - ProductAdKinetic: tipografia em movimento, cortes rápidos e as cores da marca alternando a cada tela.
export const PRODUCT_AD_TEMPLATES = ['ProductAd', 'ProductAdEditorial', 'ProductAdKinetic'] as const;

export type ProductAdTemplate = (typeof PRODUCT_AD_TEMPLATES)[number];

export function productAdCompositionId (format: ProductAdFormat, template: ProductAdTemplate = 'ProductAd') {
  return `${template}-${format}`;
}
