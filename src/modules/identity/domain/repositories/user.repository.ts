import { User } from '../entities/user.entity';

export abstract class UserRepository {
  abstract createWithCompany (companyName: string, email: string, passwordHash: string): Promise<User>;

  abstract findByEmail (email: string): Promise<User | null>;

  abstract exists (id: string, companyId: string): Promise<boolean>;
}
