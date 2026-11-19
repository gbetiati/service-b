import { Brand } from '../entities/brand.entity';

export abstract class BrandRepository {
  abstract create (entity: Brand): Promise<Brand>;

  abstract findById (id: string): Promise<Brand | null>;

  abstract findAll (): Promise<Brand[]>;
}
