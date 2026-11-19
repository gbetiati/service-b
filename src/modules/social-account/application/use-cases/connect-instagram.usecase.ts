import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AppError } from '@/shared/core/errors/app.error';
import { RequestContext } from '@/shared/core/request-context/request-context';
import { SocialPlatformProvider } from '../../domain/providers/social-platform.provider';
import { TokenCipherProvider } from '../../domain/providers/token-cipher.provider';
import { SocialAccountRepository } from '../../domain/repositories/social-account.repository';
import { InstagramCallbackDto } from '../dto/instagram-callback.dto';

@Injectable()
export class ConnectInstagramUseCase {
  constructor(
    private readonly socialAccountRepository: SocialAccountRepository,
    private readonly socialPlatformProvider: SocialPlatformProvider,
    private readonly tokenCipherProvider: TokenCipherProvider,
    private readonly requestContext: RequestContext,
  ) {}

  async execute (dto: InstagramCallbackDto, nonce: string | undefined) {
    if (!nonce || !/^[A-Za-z0-9_-]{43}$/.test(nonce)) throw new AppError('invalid', 'Abra a autorização no navegador que iniciou a conexão.');

    const identity = await this.socialAccountRepository.consumeState(createHash('sha256').update(dto.state + '.' + nonce).digest('hex'));

    if (!identity) throw new AppError('invalid', 'A autorização expirou ou já foi utilizada.');

    if (dto.error || !dto.code) throw new AppError('invalid', 'A autorização do Instagram não foi concluída.');

    this.requestContext.setIdentity(identity);
    const { accessToken, ...profile } = await this.socialPlatformProvider.connect(dto.code);
    return this.socialAccountRepository.saveInstagram(profile, this.tokenCipherProvider.encrypt(accessToken, identity.companyId));
  }
}
