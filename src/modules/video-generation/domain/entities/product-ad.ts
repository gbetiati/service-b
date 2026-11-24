// Contrato do anúncio de produto renderizado pelo Remotion. O projeto video/ importa estes tipos com `import type`.
// Mantenha este arquivo sem imports: ele também é lido pelo bundler do Remotion.

export type ProductAdCopy = { headline: string; bullets: string[]; cta: string };

export type ProductAdProps = {
  copy: ProductAdCopy;
  product: { name: string; price?: string; oldPrice?: string; imageUrl: string };
  brand: { primaryColor: string; logoUrl?: string };
};

type ProductAdInput = {
  product: { name: string; price: string | null; oldPrice: string | null };
  copy: ProductAdCopy;
  imageUrl: string;
  primaryColor: string;
  logoUrl?: string;
};

const commercialClaim = /R\$|\$\s*\d|\d+([.,]\d+)?\s*%|\b\d+([.,]\d{2})\b|\b(reais|desconto|grátis|gratis|frete)\b/i;

export class ProductAdPolicy {
  // Nome, preço, preço antigo e imagem vêm sempre do cadastro. A copy gerada por IA só fornece headline, bullets e CTA.
  static buildProps ({ product, copy, imageUrl, primaryColor, logoUrl }: ProductAdInput): ProductAdProps {
    const price = product.price === null ? undefined : formatBrl(product.price);
    const showOldPrice = price !== undefined && product.oldPrice !== null && Number(product.oldPrice) > Number(product.price);
    return {
      copy: { headline: copy.headline, bullets: [...copy.bullets], cta: copy.cta },
      product: { name: product.name, imageUrl, ...(price && { price }), ...(showOldPrice && { oldPrice: formatBrl(product.oldPrice!) }) },
      brand: { primaryColor, ...(logoUrl && { logoUrl }) },
    };
  }

  // Defesa além do prompt: a copy não pode trazer valores, descontos ou percentuais.
  static findCommercialClaim (copy: ProductAdCopy) {
    return [copy.headline, ...copy.bullets, copy.cta].find(text => commercialClaim.test(text)) ?? null;
  }
}

function formatBrl (value: string) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value)).replace(/\u00a0/g, ' ');
}
