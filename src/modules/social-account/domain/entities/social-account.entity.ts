export type SocialPlatform = 'INSTAGRAM';
export type SocialAccountStatus = 'ACTIVE' | 'DISCONNECTED';

export class SocialAccount {
  constructor(
    readonly id: string,
    readonly companyId: string,
    readonly platform: SocialPlatform,
    readonly externalId: string,
    readonly accountHandle: string,
    readonly displayName: string | null,
    readonly status: SocialAccountStatus,
    readonly metadata: unknown,
    readonly createdAt: Date,
    readonly updatedAt: Date,
  ) {}
}
