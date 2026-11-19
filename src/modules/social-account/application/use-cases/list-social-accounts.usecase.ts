import { Injectable } from '@nestjs/common';
import { SocialAccountRepository } from '../../domain/repositories/social-account.repository';

@Injectable()
export class ListSocialAccountsUseCase {
  constructor(
    private readonly socialAccountRepository: SocialAccountRepository,
  ) {}
  execute()
  { return this.socialAccountRepository.findAll(); }
}
