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

// Templates de foto do anúncio (video/src/templates/image-templates). Todos recebem as mesmas props (ProductAdProps),
// têm a mesma duração e os mesmos formatos, mostram a foto e o texto já no primeiro frame e mantêm texto, preço e CTA
// dentro da área segura do Reels (shared.tsx, useSafeArea).
// - ProductAdStory: Story de criador, com a foto sempre em tela cheia, headline no texto com fundo da ferramenta do
//   Instagram, seta e nome escritos à mão, benefícios como stickers e CTA no formato do sticker de link.
// - ProductAdReveal: headline gigante em letras vazadas com a foto por dentro (text mask), travessia para a foto
//   inteira, benefícios em tipografia cinética com marca-texto e fechamento com painel de vidro e brilho no CTA.
// - ProductAdNative: visual nativo de Reels, com câmera na mão, cortes de zoom e legendas no estilo automático.
// - ProductAdMontage: cortes rápidos em detalhes das fotos, benefícios em cartões empilhados e a foto inteira no fim.
export const PRODUCT_AD_TEMPLATES = [
  'ProductAdStory',
  'ProductAdReveal',
  'ProductAdNative',
  'ProductAdMontage',
] as const;

export type ProductAdTemplate = (typeof PRODUCT_AD_TEMPLATES)[number];

// Templates com vídeos reais (conteúdos VIDEO), em video/src/templates/video-templates. Recebem VideoAdProps e têm a
// mesma duração e os mesmos formatos. Todos abrem com movimento e texto já no frame 0 (o gancho decide se a pessoa
// fica) e mostram a marca nos primeiros segundos.
// - VideoAdResultFirst: abre no resultado (o fim do último clipe, onde costuma estar o trabalho pronto) com a headline
//   em impacto, volta ao processo com os benefícios e fecha no resultado de novo, com o CTA.
// - VideoAdOneTake: o serviço numa tomada contínua, em velocidade real e sem cortes (o formato "satisfatório" dos vídeos
//   de limpeza que viralizam), com o texto em caixas no estilo nativo do Reels e o CTA sobre a mesma tomada.
// - VideoAdCaptions: visual nativo de Reels, com cortes a cada 1,5 s, legendas palavra a palavra no estilo automático,
//   e a headline como pergunta em adesivo no primeiro segundo.
export const VIDEO_AD_TEMPLATES = ['VideoAdResultFirst', 'VideoAdOneTake', 'VideoAdCaptions'] as const;

export type VideoAdTemplate = (typeof VIDEO_AD_TEMPLATES)[number];

export type AdTemplate = ProductAdTemplate | VideoAdTemplate;

// Faixas da música de fundo, em video/public/music/<faixa>.mp3. As atuais são placeholders gerados para teste:
// substitua por faixas com licença de uso comercial em anúncios e atualize esta lista.
export const PRODUCT_AD_MUSIC_TRACKS = ['placeholder-pulse', 'placeholder-warm'] as const;

export function productAdCompositionId (format: ProductAdFormat, template: AdTemplate = PRODUCT_AD_TEMPLATES[0]) {
  return `${template}-${format}`;
}
