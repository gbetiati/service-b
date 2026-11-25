// Contrato do anúncio de produto renderizado pelo Remotion. O projeto video/ importa estes tipos com `import type`.
// Mantenha este arquivo sem imports: ele também é lido pelo bundler do Remotion.

export type ProductAdCopy = { headline: string; bullets: string[]; cta: string };

// Um trecho da locução: URL do MP3 e duração medida, para o template encaixar a fala na cena.
export type ProductAdVoiceClip = { src: string; durationInSeconds: number };

// Áudio do anúncio. `musicTrack` é uma faixa de PRODUCT_AD_MUSIC_TRACKS. `voiceover` tem um clipe por trecho do roteiro.
export type ProductAdAudio = {
  musicTrack?: string;
  voiceover?: { hook: ProductAdVoiceClip; benefits: ProductAdVoiceClip[]; cta: ProductAdVoiceClip };
};

export type ProductAdProps = {
  copy: ProductAdCopy;
  product: { name: string; price?: string; oldPrice?: string; imageUrl: string };
  brand: { primaryColor: string; secondaryColor?: string; logoUrl?: string };
  audio?: ProductAdAudio;
};

export type ProductAdPalette = { primaryColor: string | null; secondaryColor: string | null };

export type BrandColors = ProductAdPalette & { tertiaryColor?: string | null; quaternaryColor?: string | null };

type ProductAdInput = {
  product: { name: string; price: string | null; oldPrice: string | null };
  copy: ProductAdCopy;
  imageUrl: string;
  primaryColor: string;
  secondaryColor?: string | null;
  logoUrl?: string;
  audio?: ProductAdAudio;
};

// Contraste mínimo (razão WCAG) entre as duas cores sorteadas: evita pares quase iguais, como dois tons pastel.
export const MIN_PALETTE_CONTRAST = 2;

const commercialClaim = /R\$|\$\s*\d|\d+([.,]\d+)?\s*%|\b\d+([.,]\d{2})\b|\b(reais|desconto|grátis|gratis|frete)\b/i;

export class ProductAdPolicy {
  // Nome, preço, preço antigo e imagem vêm sempre do cadastro. A copy gerada por IA só fornece headline, bullets e CTA.
  static buildProps ({ product, copy, imageUrl, primaryColor, secondaryColor, logoUrl, audio }: ProductAdInput): ProductAdProps {
    const price = product.price === null ? undefined : formatBrl(product.price);
    const showOldPrice = price !== undefined && product.oldPrice !== null && Number(product.oldPrice) > Number(product.price);
    return {
      copy: { headline: copy.headline, bullets: [...copy.bullets], cta: copy.cta },
      product: { name: product.name, imageUrl, ...(price && { price }), ...(showOldPrice && { oldPrice: formatBrl(product.oldPrice!) }) },
      brand: { primaryColor, ...(secondaryColor && { secondaryColor }), ...(logoUrl && { logoUrl }) },
      ...(audio && (audio.musicTrack || audio.voiceover) && { audio }),
    };
  }

  // Varia o anúncio sem perder a identidade da marca. O par é sempre uma cor base (principal ou secundária cadastrada),
  // que assume o papel de cor principal do vídeo, com uma cor de apoio (terciária ou quaternária). Só entram pares com
  // contraste mínimo entre si; sem nenhum, usa o de maior contraste. Sem cores de apoio cadastradas, as duas bases
  // formam o par; sem cores base, as de apoio. Com menos de duas cores, nada muda.
  static pickPalette (colors: BrandColors, random: () => number): ProductAdPalette {
    const base = distinct([colors.primaryColor, colors.secondaryColor]);
    const support = distinct([colors.tertiaryColor, colors.quaternaryColor]).filter(color => !base.includes(color));
    const all = [...base, ...support];

    if (all.length < 2) return { primaryColor: colors.primaryColor, secondaryColor: colors.secondaryColor };

    const pairs = (base.length && support.length ? base.flatMap(lead => support.map(other => [lead, other])) : orderedPairs(base.length >= 2 ? base : support))
      .map(([lead, other]) => ({ lead, other, contrast: contrastRatio(lead, other) }));
    const readable = pairs.filter(pair => pair.contrast >= MIN_PALETTE_CONTRAST);
    const best = Math.max(...pairs.map(pair => pair.contrast));
    const options = readable.length ? readable : pairs.filter(pair => pair.contrast === best);
    const { lead, other } = options[Math.floor(random() * options.length)];
    return { primaryColor: lead, secondaryColor: other };
  }

  // Defesa além do prompt: a copy não pode trazer valores, descontos ou percentuais.
  static findCommercialClaim (copy: ProductAdCopy) {
    return [copy.headline, ...copy.bullets, copy.cta].find(text => commercialClaim.test(text)) ?? null;
  }
}

function formatBrl (value: string) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value)).replace(/\u00a0/g, ' ');
}

// Todos os pares ordenados (a, b) com a ≠ b.
function orderedPairs (colors: string[]) {
  return colors.flatMap(lead => colors.filter(other => other !== lead).map(other => [lead, other]));
}

function distinct (colors: (string | null | undefined)[]) {
  return [...new Set(colors.filter((color): color is string => !!color).map(color => color.toLowerCase()))];
}

// Razão de contraste WCAG entre duas cores #rrggbb (de 1 a 21).
export function contrastRatio (first: string, second: string) {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

function luminance (hex: string) {
  const [r, g, b] = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255).map(channel => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
