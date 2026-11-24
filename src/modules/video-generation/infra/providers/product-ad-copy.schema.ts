import { z } from 'zod';
import type { ProductAdCopy } from '../../domain/entities/product-ad';

// Somente o que o LLM gera. Preço, nome e imagem nunca passam por aqui.
export const CopySchema = z.object({
  headline: z.string().min(3).max(40),
  bullets: z.array(z.string().min(3).max(50)).min(2).max(4),
  cta: z.string().min(2).max(25),
});

export type Copy = z.infer<typeof CopySchema>;

// Garante em tempo de compilação que o schema e o contrato do template continuam iguais.
const sameShape: [Copy, ProductAdCopy] extends [ProductAdCopy, Copy] ? true : never = true;
void sameShape;
