import { Product } from '../entities/product.entity';

export abstract class ProductRepository {
  abstract create (entity: Product): Promise<Product>;

  abstract findById (id: string): Promise<Product | null>;

  abstract findAll (): Promise<Product[]>;
}
