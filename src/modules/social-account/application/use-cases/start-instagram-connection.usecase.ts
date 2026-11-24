import { Injectable } from '@nestjs/common';
import { OAuthState } from '../../domain/entities/oauth-state';
import { SocialPlatformProvider } from '../../domain/providers/social-platform.provider';
import { SocialAccountRepository } from '../../domain/repositories/social-account.repository';

@Injectable()
export class StartInstagramConnectionUseCase {
  constructor(
    private readonly socialPlatformProvider: SocialPlatformProvider,
    private readonly socialAccountRepository: SocialAccountRepository,
  ) {}

  async execute () {
    const { state, nonce, hash } = OAuthState.generate();
    const authorizationUrl = this.socialPlatformProvider.authorizationUrl(state);
    await this.socialAccountRepository.saveState(hash, OAuthState.expiresAt());
    return { authorizationUrl, nonce };
  }
}
