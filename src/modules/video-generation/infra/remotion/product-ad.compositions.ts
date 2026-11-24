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

export const PRODUCT_AD_COMPOSITION = 'ProductAd';

export function productAdCompositionId (format: ProductAdFormat) {
  return `${PRODUCT_AD_COMPOSITION}-${format}`;
}
