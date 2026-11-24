import { Injectable } from '@nestjs/common';
import { AppError, requireRecord } from '@/shared/core/errors/app.error';
import { SocialPlatformProvider } from '../../domain/providers/social-platform.provider';
import { TokenCipherProvider } from '../../domain/providers/token-cipher.provider';
import { SocialAccountRepository } from '../../domain/repositories/social-account.repository';

@Injectable()
export class RefreshInstagramTokenUseCase {
  constructor(
    private readonly socialAccountRepository: SocialAccountRepository,
    private readonly socialPlatformProvider: SocialPlatformProvider,
    private readonly tokenCipherProvider: TokenCipherProvider,
  ) {}

  async execute (id: string) {
    const current = requireRecord(await this.socialAccountRepository.credential(id), 'Credencial');

    if (current.isExpired()) throw new AppError('conflict', 'A credencial expirou. Conecte a conta novamente.');

    if (!current.isOldEnoughToRefresh()) throw new AppError('conflict', 'O token precisa ter pelo menos 24 horas.');

    const refreshed = await this.socialPlatformProvider.refresh(this.tokenCipherProvider.decrypt(current, current.companyId));
    const encrypted = this.tokenCipherProvider.encrypt(refreshed.accessToken, current.companyId);
    await this.socialAccountRepository.updateCredential(current, { ...encrypted, expiresAt: refreshed.expiresAt });
    return { expiresAt: refreshed.expiresAt };
  }
}
