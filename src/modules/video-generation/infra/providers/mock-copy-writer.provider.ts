import { Injectable, Logger } from '@nestjs/common';
import type { ProductAdCopy } from '../../domain/entities/product-ad';
import { CopyContext, CopyWriterProvider } from '../../domain/providers/copy-writer.provider';

// TESTE (mock): substitui o Claude enquanto não há ANTHROPIC_API_KEY. Monta uma copy fixa a partir do cadastro.
@Injectable()
export class MockCopyWriterProvider implements CopyWriterProvider {
  private readonly logger = new Logger(MockCopyWriterProvider.name);

  async write({ name, description, brand }: CopyContext): Promise<ProductAdCopy> {
    this.logger.warn(`Copy simulada (mock) para o produto "${name}".`);
    return {
      headline: truncate(name, 40),
      bullets: [
        truncate(description?.trim() || 'Qualidade para o seu dia a dia', 50),
        truncate(brand ? `Da marca ${brand}` : 'Produto original', 50)],
      cta: 'Compre agora',
    };
  }
}

function truncate(text: string, max: number) {
  return text.length <= max ? text : text.slice(0, max - 1).trimEnd() + '…';
}
