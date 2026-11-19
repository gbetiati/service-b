import { Module } from '@nestjs/common';
import { ExternalApiModule } from '@/shared/libs/http/external-api.module';
import { ConnectInstagramUseCase } from './application/use-cases/connect-instagram.usecase';
import { ListSocialAccountsUseCase } from './application/use-cases/list-social-accounts.usecase';
import { RefreshInstagramTokenUseCase } from './application/use-cases/refresh-instagram-token.usecase';
import { StartInstagramConnectionUseCase } from './application/use-cases/start-instagram-connection.usecase';
import { SocialPlatformProvider } from './domain/providers/social-platform.provider';
import { TokenCipherProvider } from './domain/providers/token-cipher.provider';
import { SocialAccountRepository } from './domain/repositories/social-account.repository';
import { SocialAccountController } from './infra/controllers/social-account.controller';
import { PrismaSocialAccountRepository } from './infra/prisma/social-account.prisma-repository';
import { AesTokenCipherProvider } from './infra/providers/aes-token-cipher.provider';
import { InstagramProvider } from './infra/providers/instagram.provider';

@Module({
  imports: [ExternalApiModule],
  controllers: [SocialAccountController],
  providers: [
    ConnectInstagramUseCase, ListSocialAccountsUseCase, RefreshInstagramTokenUseCase, StartInstagramConnectionUseCase,
    { provide: SocialAccountRepository, useClass: PrismaSocialAccountRepository },
    { provide: SocialPlatformProvider, useClass: InstagramProvider },
    { provide: TokenCipherProvider, useClass: AesTokenCipherProvider },
  ],
  exports: [SocialPlatformProvider, TokenCipherProvider],
})
export class SocialAccountModule {}
