import { SocialAccount } from '../entities/social-account.entity';
import { EncryptedToken, SocialCredential } from '../entities/social-credential.entity';
import { ConnectedAccount } from '../providers/social-platform.provider';

type ConnectedProfile = Omit<ConnectedAccount, 'accessToken'>;
type CredentialUpdate = EncryptedToken & { expiresAt: Date };

export abstract class SocialAccountRepository {
  abstract saveState (hash: string, expiresAt: Date): Promise<void>;

  abstract consumeState (hash: string): Promise<{ companyId: string; userId: string } | null>;

  abstract saveInstagram (profile: ConnectedProfile, token: EncryptedToken): Promise<SocialAccount>;

  abstract findAll (): Promise<SocialAccount[]>;

  abstract credential (accountId: string): Promise<SocialCredential | null>;

  abstract updateCredential (current: SocialCredential, update: CredentialUpdate): Promise<void>;
}
