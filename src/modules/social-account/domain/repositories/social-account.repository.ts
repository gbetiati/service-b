import { SocialAccount } from '../entities/social-account.entity';
import { EncryptedToken, SocialCredential } from '../entities/social-credential.entity';
import { ConnectedAccount } from '../providers/social-platform.provider';

type ConnectedProfile = Omit<ConnectedAccount, 'accessToken'>;
type CredentialUpdate = EncryptedToken & { expiresAt: Date };
export type CredentialOwner = { companyId: string; socialAccountId: string };

export abstract class SocialAccountRepository {
  abstract saveState (hash: string, expiresAt: Date): Promise<void>;

  abstract consumeState (hash: string): Promise<{ companyId: string; userId: string } | null>;

  abstract saveInstagram (profile: ConnectedProfile, token: EncryptedToken): Promise<SocialAccount>;

  abstract findAll (): Promise<SocialAccount[]>;

  abstract credential (accountId: string): Promise<SocialCredential | null>;

  abstract updateCredential (current: SocialCredential, update: CredentialUpdate): Promise<void>;

  abstract disconnect (accountId: string): Promise<SocialAccount | null>;

  // Usados pelo cron, sem contexto de empresa: buscam em todas as empresas.
  abstract findCredentialsToRefresh (expiringBefore: Date, updatedBefore: Date, limit: number): Promise<CredentialOwner[]>;

  abstract disconnectExpired (now: Date): Promise<number>;
}
