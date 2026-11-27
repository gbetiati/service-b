import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { loadFont } from '@remotion/fonts';

export const FONT_FAMILY = 'Inter';
// Letra manuscrita (Caveat, licença OFL) para anotações à mão, como as que os criadores escrevem por cima do vídeo.
export const HAND_FONT = 'Caveat';

// Fontes locais (video/public/fonts): o render não depende de rede para tipografia.
loadFont({ family: FONT_FAMILY, url: staticFile('fonts/Inter.ttf'), weight: '100 900' });
loadFont({ family: HAND_FONT, url: staticFile('fonts/Caveat.ttf'), weight: '400 700' });

// `unit` escala medidas pensadas para 1080 px no menor lado do vídeo, para o mesmo layout servir aos três formatos.
export function useLayout () {
  const { width, height } = useVideoConfig();
  return { unit: Math.min(width, height) / 1080, landscape: width > height, portrait: height > width };
}

export function useEnter (delay = 0, damping = 200) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping } });
}

export const ProductImage: React.FC<{ imageUrl: string; zoom: number; dim?: number; blur?: number }> = ({ imageUrl, zoom, dim = 0, blur = 0 }) => (
  <AbsoluteFill style={{ overflow: 'hidden' }}>
    <Img src={imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${zoom})`, filter: blur ? `blur(${blur}px)` : undefined }} />
    {dim > 0 && <AbsoluteFill style={{ backgroundColor: `rgba(0,0,0,${dim})` }} />}
  </AbsoluteFill>
);

// Fotos do produto para os templates de foto (de 1 a 3, a principal primeiro). `imageAt` devolve a foto da cena
// `index` e volta ao começo quando há menos fotos que cenas: com uma foto só, todas as cenas usam a mesma, como antes.
export function productImages (product: { imageUrl: string; imageUrls?: string[] }) {
  return product.imageUrls?.length ? product.imageUrls : [product.imageUrl];
}

export function imageAt (product: { imageUrl: string; imageUrls?: string[] }, index: number) {
  const images = productImages(product);
  return images[((index % images.length) + images.length) % images.length];
}

// Selo com o logo da marca nos primeiros segundos, no canto superior direito da área segura: os textos dos templates
// ficam centralizados, então esse canto fica livre. O fundo branco translúcido mantém legível um logo escuro sobre foto
// escura. Entra já no frame 0 e sai em fade até `until`; o logo do fim fica na cena de fechamento de cada template.
// Altura reservada no topo da área segura enquanto o selo do logo está na tela: as cenas de abertura descem o texto
// por essa altura quando há logo, para a headline nunca passar por baixo do selo.
export const LOGO_BUG_SPACE = 175;

export const LogoBug: React.FC<{ logoUrl?: string; until?: number }> = ({ logoUrl, until = 75 }) => {
  const frame = useCurrentFrame();
  const safe = useSafeArea();
  const { unit } = useLayout();

  if (!logoUrl || frame >= until) return null;

  const fade = interpolate(frame, [until - 15, until], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return <LogoBadge logoUrl={logoUrl} height={120} style={{ position: 'absolute', top: safe.top + 8 * unit, right: safe.right, opacity: fade, transform: `translateY(${(1 - fade) * -12 * unit}px)` }} />;
};

// Logo numa placa branca translúcida, para ler sobre qualquer foto ou cor da marca. Usado no selo do começo e no
// fechamento dos templates. `height` é a altura máxima do logo, em px para o lado menor de 1080.
export const LogoBadge: React.FC<{ logoUrl: string; height: number; style?: React.CSSProperties }> = ({ logoUrl, height, style }) => {
  const { unit } = useLayout();
  return (
    <div style={{
      display: 'inline-flex', padding: `${height * 0.14 * unit}px ${height * 0.22 * unit}px`, borderRadius: height * 0.24 * unit,
      backgroundColor: 'rgba(255,255,255,0.88)', boxShadow: `0 ${6 * unit}px ${18 * unit}px rgba(0,0,0,0.25)`, ...style,
    }}>
      <Img src={logoUrl} style={{ display: 'block', maxWidth: height * 2.4 * unit, maxHeight: height * unit, objectFit: 'contain' }} />
    </div>
  );
};

export function isHex (value: string) {
  return /^#[0-9a-f]{6}$/i.test(value);
}

export function safeColor (value: string) {
  return isHex(value) ? value : '#2563eb';
}

// Cor de apoio opcional, validada.
export function optionalColor (value?: string) {
  return value && isHex(value) ? value : undefined;
}

// Texto escuro ou claro, conforme a luminância do fundo.
export function readableOn (hex: string) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#111111' : '#ffffff';
}

// Área livre da interface do app. No 9x16 (Reels/Stories), os anúncios da Meta cobrem cerca de 14% em cima (perfil e
// áudio), 35% embaixo (legenda e botão de CTA) e 6% nas laterais. Texto, preço e CTA ficam dentro dessa área; foto e
// fundo podem ocupar a tela toda. Nos outros formatos, margem uniforme de 6%.
export function useSafeArea () {
  const { width, height } = useVideoConfig();
  const tall = height / width > 1.5;
  const side = Math.min(width, height) * 0.06;
  const top = tall ? height * 0.14 : side;
  const bottom = tall ? height * 0.35 : side;
  const innerHeight = height - top - bottom;
  return { top, bottom, left: side, right: side, width: width - 2 * side, height: innerHeight, centerY: top + innerHeight / 2, tall };
}

export const SafeArea: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => {
  const safe = useSafeArea();
  return <AbsoluteFill style={{ paddingTop: safe.top, paddingBottom: safe.bottom, paddingLeft: safe.left, paddingRight: safe.right, ...style }}>{children}</AbsoluteFill>;
};

export function splitWords (text: string) {
  return text.trim().split(/\s+/).filter(Boolean);
}

// A cor da marca como cor de texto sobre fundo branco; se for clara demais (ex.: amarelo), usa quase preto.
export function inkOnWhite (hex: string) {
  return readableOn(hex) === '#ffffff' ? hex : '#111111';
}

// Reduz a fonte de textos curtos e sem quebra (como preços) para caberem numa largura dada em caracteres.
export function fitFontSize (text: string, base: number, maxChars: number) {
  return text.length > maxChars ? (base * maxChars) / text.length : base;
}

// Mistura duas cores #rrggbb (amount 0 = a, 1 = b). Serve para derivar tons da marca, como um fundo escuro da cor principal.
export function mix (a: string, b: string, amount: number) {
  const channel = (hex: string, index: number) => parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16);
  return '#' + [0, 1, 2].map(index => Math.round(channel(a, index) + (channel(b, index) - channel(a, index)) * amount).toString(16).padStart(2, '0')).join('');
}

// Intervalo, em frames, entre a entrada de cada benefício: distribui os itens pela janela da cena, no ritmo de uma
// fala por item, sem passar de `max`. Os templates usam o mesmo valor para o visual e para a locução.
export function benefitGap (count: number, window: number, max: number) {
  return count ? Math.min(max, window / count) : 0;
}
