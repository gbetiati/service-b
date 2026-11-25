import { Injectable } from '@nestjs/common';
import { AppError } from '@/shared/core/errors/app.error';
import { RequestContext } from '@/shared/core/request-context/request-context';
import { OAuthState } from '../../domain/entities/oauth-state';
import { SocialPlatformProvider } from '../../domain/providers/social-platform.provider';
import { TokenCipherProvider } from '../../domain/providers/token-cipher.provider';
import { SocialAccountRepository } from '../../domain/repositories/social-account.repository';
import { CompleteInstagramConnectionDto } from '../dto/complete-instagram-connection.dto';

// Conclui a conexão iniciada pelo mesmo usuário: o state precisa casar com o nonce guardado na aba que abriu a
// autorização. Assim, um link de autorização gerado por outra pessoa não liga a conta de quem o abriu à empresa dela.
@Injectable()
export class ConnectInstagramUseCase {
  constructor(
    private readonly socialAccountRepository: SocialAccountRepository,
    private readonly socialPlatformProvider: SocialPlatformProvider,
    private readonly tokenCipherProvider: TokenCipherProvider,
    private readonly requestContext: RequestContext,
  ) {}

  async execute ({ state, nonce, code, error }: CompleteInstagramConnectionDto) {
    const { userId, companyId } = this.requestContext.identity;
    const owner = await this.socialAccountRepository.consumeState(OAuthState.hash(state, nonce));

    if (!owner || owner.userId !== userId || owner.companyId !== companyId) throw new AppError('invalid', 'A autorização expirou, já foi utilizada ou foi iniciada em outra sessão.');

    if (error || !code) throw new AppError('invalid', 'A autorização do Instagram não foi concluída.');

    const { accessToken, ...profile } = await this.socialPlatformProvider.connect(code);
    return this.socialAccountRepository.saveInstagram(profile, this.tokenCipherProvider.encrypt(accessToken, companyId));
  }
}
