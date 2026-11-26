import { Brand } from '../entities/brand.entity';

export abstract class BrandRepository {
  abstract create (entity: Brand): Promise<Brand>;

  abstract findById (id: string): Promise<Brand | null>;

  abstract findAll (): Promise<Brand[]>;

  // Exclui a marca com campanhas, regras, produtos e imagens. Devolve as chaves dos arquivos no storage, ou null se não existir.
  abstract delete (id: string): Promise<string[] | null>;
}
