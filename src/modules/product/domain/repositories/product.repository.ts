import { Product } from '../entities/product.entity';

export abstract class ProductRepository {
  abstract create (entity: Product): Promise<Product>;

  abstract findById (id: string): Promise<Product | null>;

  abstract findAll (offset?: number, limit?: number): Promise<Product[]>;

  // Exclui o produto com as imagens. Devolve as chaves dos arquivos no storage, ou null se não existir.
  abstract delete (id: string): Promise<string[] | null>;
}
