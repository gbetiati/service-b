import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { SocialPlatformProvider } from '../../domain/providers/social-platform.provider';
import { SocialAccountRepository } from '../../domain/repositories/social-account.repository';

@Injectable()
export class StartInstagramConnectionUseCase {
  constructor(
    private readonly socialPlatformProvider: SocialPlatformProvider,
    private readonly socialAccountRepository: SocialAccountRepository,
  ) {}

  async execute () {
    const state = randomBytes(32).toString('base64url');
    const nonce = randomBytes(32).toString('base64url');
    const authorizationUrl = this.socialPlatformProvider.authorizationUrl(state);
    await this.socialAccountRepository.saveState(createHash('sha256').update(state + '.' + nonce).digest('hex'), new Date(Date.now() + 600_000));
    return { authorizationUrl, nonce };
  }
}
