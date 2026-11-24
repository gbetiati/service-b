const MIN_REFRESH_AGE_MS = 86_400_000;

export class SocialCredential {
  constructor(
    readonly id: string,
    readonly companyId: string,
    readonly socialAccountId: string,
    readonly kind: string,
    readonly encryptedValue: string,
    readonly initializationVector: string,
    readonly expiresAt: Date | null,
    readonly scopes: string[],
    readonly createdAt: Date,
    readonly updatedAt: Date,
  ) {}

  isExpired (now = Date.now()) {
    return !this.expiresAt || this.expiresAt.getTime() <= now;
  }

  // O Instagram só renova tokens de longa duração com pelo menos 24 horas.
  isOldEnoughToRefresh (now = Date.now()) {
    return now - this.updatedAt.getTime() >= MIN_REFRESH_AGE_MS;
  }
}

export type EncryptedToken = Pick<SocialCredential, 'encryptedValue' | 'initializationVector'>;
