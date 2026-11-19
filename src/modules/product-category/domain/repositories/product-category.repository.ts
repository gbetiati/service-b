import { ProductCategory } from '../entities/product-category.entity';

export abstract class ProductCategoryRepository {
  abstract create (entity: ProductCategory): Promise<ProductCategory>;

  abstract findById (id: string): Promise<ProductCategory | null>;

  abstract findAll (): Promise<ProductCategory[]>;
}
