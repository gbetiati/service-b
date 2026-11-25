import { Module } from '@nestjs/common';
import { ExternalApiModule } from '@/shared/libs/http/external-api.module';
import { ExternalApiProvider } from '@/shared/libs/http/external-api.provider';
import { ConnectInstagramUseCase } from './application/use-cases/connect-instagram.usecase';
import { DisconnectSocialAccountUseCase } from './application/use-cases/disconnect-social-account.usecase';
import { ListSocialAccountsUseCase } from './application/use-cases/list-social-accounts.usecase';
import { RefreshExpiringInstagramTokensUseCase } from './application/use-cases/refresh-expiring-instagram-tokens.usecase';
import { RefreshInstagramTokenUseCase } from './application/use-cases/refresh-instagram-token.usecase';
import { StartInstagramConnectionUseCase } from './application/use-cases/start-instagram-connection.usecase';
import { SocialPlatformProvider } from './domain/providers/social-platform.provider';
import { TokenCipherProvider } from './domain/providers/token-cipher.provider';
import { SocialAccountRepository } from './domain/repositories/social-account.repository';
import { SocialAccountController } from './infra/controllers/social-account.controller';
import { PrismaSocialAccountRepository } from './infra/prisma/social-account.prisma-repository';
import { AesTokenCipherProvider } from './infra/providers/aes-token-cipher.provider';
import { FacebookBusinessLoginProvider } from './infra/providers/facebook-business-login.provider';
import { InstagramProvider } from './infra/providers/instagram.provider';
import { SocialAccountScheduler } from './infra/schedule/social-account.scheduler';

// Com INSTAGRAM_CONFIG_ID, o app usa o login unificado (Login do Facebook para Empresas com configuração); sem ele, o
// Login do Instagram. O tipo aparece na URL de login do painel da Meta: facebook.com com config_id, ou instagram.com.
function socialPlatformProvider (externalApiProvider: ExternalApiProvider) {
  return process.env.INSTAGRAM_CONFIG_ID?.trim() ? new FacebookBusinessLoginProvider(externalApiProvider) : new InstagramProvider(externalApiProvider);
}

@Module({
  imports: [ExternalApiModule],
  controllers: [SocialAccountController],
  providers: [
    ConnectInstagramUseCase, ListSocialAccountsUseCase, RefreshInstagramTokenUseCase, StartInstagramConnectionUseCase,
    RefreshExpiringInstagramTokensUseCase, SocialAccountScheduler, DisconnectSocialAccountUseCase,
    { provide: SocialAccountRepository, useClass: PrismaSocialAccountRepository },
    { provide: SocialPlatformProvider, inject: [ExternalApiProvider], useFactory: socialPlatformProvider },
    { provide: TokenCipherProvider, useClass: AesTokenCipherProvider },
  ],
  exports: [SocialPlatformProvider, TokenCipherProvider],
})
export class SocialAccountModule {}
