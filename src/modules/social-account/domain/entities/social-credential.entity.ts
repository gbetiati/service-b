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
}
export type EncryptedToken = Pick<SocialCredential, 'encryptedValue' | 'initializationVector'>;
