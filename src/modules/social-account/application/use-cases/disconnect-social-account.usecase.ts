import { Injectable } from '@nestjs/common';
import { AppError } from '@/shared/core/errors/app.error';
import { SocialAccountRepository } from '../../domain/repositories/social-account.repository';

// Desconecta a conta da empresa: o token é apagado e as publicações dela deixam de ser enviadas. Para voltar, basta conectar de novo.
@Injectable()
export class DisconnectSocialAccountUseCase {
  constructor(
    private readonly socialAccountRepository: SocialAccountRepository,
  ) {}

  async execute (id: string) {
    const account = await this.socialAccountRepository.disconnect(id);

    if (!account) throw new AppError('missing', 'Conta social não encontrada.');

    return account;
  }
}
