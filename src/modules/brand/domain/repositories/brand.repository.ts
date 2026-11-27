import { Brand } from '../entities/brand.entity';

export abstract class BrandRepository {
  abstract create (entity: Brand): Promise<Brand>;

  abstract findById (id: string): Promise<Brand | null>;

  abstract findAll (): Promise<Brand[]>;

  // Aponta a marca para outro logo (ou nenhum, com null). Devolve a chave do logo anterior, ou null se a marca não existir.
  abstract updateLogo (id: string, logoStorageKey: string | null): Promise<{ previous: string | null } | null>;

  // Exclui a marca com campanhas, regras, produtos e imagens. Devolve as chaves dos arquivos no storage, ou null se não existir.
  abstract delete (id: string): Promise<string[] | null>;
}
