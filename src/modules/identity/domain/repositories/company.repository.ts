import { Company } from '../entities/company.entity';

export abstract class CompanyRepository {
  abstract findCurrent (): Promise<Company | null>;
}
