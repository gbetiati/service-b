import { EncryptedToken } from '../entities/social-credential.entity';

export abstract class TokenCipherProvider {
  abstract encrypt(token: string, companyId: string): EncryptedToken;
  abstract decrypt(token: EncryptedToken, companyId: string): string;
}
