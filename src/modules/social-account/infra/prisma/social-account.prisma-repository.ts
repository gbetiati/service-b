import { Injectable } from '@nestjs/common';
import type { SocialAccount as Row } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { RequestContext } from '@/shared/core/request-context/request-context';
import { AppError } from '@/shared/core/errors/app.error';
import { SocialAccount } from '../../domain/entities/social-account.entity';
import { EncryptedToken, SocialCredential } from '../../domain/entities/social-credential.entity';
import { ConnectedAccount } from '../../domain/providers/social-platform.provider';
import { SocialAccountRepository } from '../../domain/repositories/social-account.repository';

@Injectable()
export class PrismaSocialAccountRepository implements SocialAccountRepository {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly requestContext: RequestContext,
  ) {}

  async saveState(hash: string, expiresAt: Date)
  {
    const { userId, companyId } = this.requestContext.identity;
    await this.prismaService.$transaction([
      this.prismaService.oAuthState.deleteMany({ where: { userId, companyId, expiresAt: { lte: new Date() } } }),
      this.prismaService.oAuthState.create({ data: { hash, expiresAt, userId, companyId } }),
    ]);
  }

  async consumeState(hash: string)
  {
    return this.prismaService.$transaction(async tx => {
      const state = await tx.oAuthState.findUnique({ where: { hash } });
      if (!state) return null;
      const deleted = await tx.oAuthState.deleteMany({ where: { hash, expiresAt: { gt: new Date() } } });
      return deleted.count ? { companyId: state.companyId, userId: state.userId } : null;
    });
  }

  saveInstagram(profile: Omit<ConnectedAccount, 'accessToken'>, token: EncryptedToken)
  {
    const companyId = this.requestContext.companyId;
    const identity = { companyId, platform: 'INSTAGRAM' as const, externalId: profile.externalId };
    const account = { accountHandle: profile.handle, displayName: profile.displayName, status: 'ACTIVE' as const };
    return this.prismaService.serializable(async tx => {
      const row = await tx.socialAccount.upsert({
        where: { companyId_platform_externalId: identity }, create: { ...identity, ...account }, update: account,
      });
      const key = { companyId, socialAccountId: row.id, kind: 'access_token' };
      const credential = { ...token, expiresAt: profile.expiresAt, scopes: profile.scopes };
      await tx.socialCredential.upsert({
        where: { companyId_socialAccountId_kind: key }, create: { ...key, ...credential }, update: credential,
      });
      return this.toDomain(row);
    });
  }

  async findAll()
  {
    const rows = await this.prismaService.socialAccount.findMany({ where: { companyId: this.requestContext.companyId }, orderBy: { createdAt: 'desc' } });
    return rows.map(row => this.toDomain(row));
  }
  async credential(socialAccountId: string)
  {
    const row = await this.prismaService.socialCredential.findFirst({
      where: { companyId: this.requestContext.companyId, socialAccountId, kind: 'access_token', socialAccount: { status: 'ACTIVE' } },
    });
    return row && new SocialCredential(
      row.id, row.companyId, row.socialAccountId, row.kind, row.encryptedValue, row.initializationVector, row.expiresAt,
      Array.isArray(row.scopes) ? row.scopes.filter((scope): scope is string => typeof scope === 'string') : [], row.createdAt, row.updatedAt,
    );
  }
  async updateCredential(current: SocialCredential, update: EncryptedToken & { expiresAt: Date })
  {
    const result = await this.prismaService.socialCredential.updateMany({
      where: { id: current.id, companyId: this.requestContext.companyId, updatedAt: current.updatedAt }, data: update,
    });
    if (!result.count) throw new AppError('conflict', 'A credencial mudou durante a renovação.');
  }

  private toDomain(row: Row)
  {
    return new SocialAccount(
      row.id, row.companyId, row.platform, row.externalId, row.accountHandle, row.displayName,
      row.status, row.metadata, row.createdAt, row.updatedAt,
    );
  }
}
