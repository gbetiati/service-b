// Composições registradas no projeto Remotion (video/src/Root.tsx importa este arquivo).
// Mantenha este arquivo sem imports: ele também é lido pelo bundler do Remotion.

export const PRODUCT_AD_FORMATS = ['9x16', '1x1', '16x9'] as const;

export type ProductAdFormat = (typeof PRODUCT_AD_FORMATS)[number];

export const PRODUCT_AD_FPS = 30;
// 15 s: o limite de cima da faixa que mais converte em Reels, com espaço para a locução de gancho, benefícios e chamada.
// Cada template distribui as próprias cenas nesse total; mudar este valor exige redistribuir os SCENES dos templates.
export const PRODUCT_AD_DURATION_IN_FRAMES = 450;

export const PRODUCT_AD_DIMENSIONS: Record<ProductAdFormat, { width: number; height: number }> = {
  '9x16': { width: 1080, height: 1920 },
  '1x1': { width: 1080, height: 1080 },
  '16x9': { width: 1920, height: 1080 },
};

// Templates do anúncio. Todos recebem as mesmas props (ProductAdProps) e têm a mesma duração e os mesmos formatos.
// - ProductAd: foto em tela cheia, headline sobre degradê e cenas com a foto desfocada.
// - ProductAdEditorial: estilo revista, fundo na cor principal, foto em cartão e benefícios numerados.
// - ProductAdKinetic: tipografia em movimento, cortes rápidos e as cores da marca alternando a cada tela.
// - ProductAdChecklist: benefícios marcados um a um num cartão e fechamento com "toque" no botão de CTA.
// - ProductAdCallouts: a foto encolhe para um círculo iluminado e os benefícios viram etiquetas ligadas ao produto.
// - ProductAdNative: visual nativo de Reels, com câmera na mão, cortes de zoom e legendas no estilo automático.
// - ProductAdOffer: abre com o preço e o desconto, mostra produto e benefícios e fecha retomando a oferta.
// - ProductAdMontage: cortes rápidos em detalhes da foto, benefícios em cartões empilhados e a foto inteira no fim.
// Os templates novos mantêm texto, preço e CTA dentro da área segura do Reels (shared.tsx, useSafeArea).
export const PRODUCT_AD_TEMPLATES = [
  'ProductAd',
  'ProductAdEditorial',
  'ProductAdKinetic',
  'ProductAdChecklist',
  'ProductAdCallouts',
  'ProductAdNative',
  'ProductAdOffer',
  'ProductAdMontage',
] as const;

export type ProductAdTemplate = (typeof PRODUCT_AD_TEMPLATES)[number];

// Faixas da música de fundo, em video/public/music/<faixa>.mp3. As atuais são placeholders gerados para teste:
// substitua por faixas com licença de uso comercial em anúncios e atualize esta lista.
export const PRODUCT_AD_MUSIC_TRACKS = ['placeholder-pulse', 'placeholder-warm'] as const;

export function productAdCompositionId (format: ProductAdFormat, template: ProductAdTemplate = 'ProductAd') {
  return `${template}-${format}`;
}
