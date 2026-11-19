import { Controller, Get, Header, Headers, Param, ParseUUIDPipe, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { CookieOptions, Response } from 'express';
import { servicePublicUrl } from '@/shared/core/config';
import { TenantGuard } from '@/modules/identity/infra/guards/tenant.guard';
import { JwtAuthGuard } from '@/modules/identity/infra/jwt/jwt-auth.guard';
import { InstagramCallbackDto } from '../../application/dto/instagram-callback.dto';
import { ConnectInstagramUseCase } from '../../application/use-cases/connect-instagram.usecase';
import { ListSocialAccountsUseCase } from '../../application/use-cases/list-social-accounts.usecase';
import { RefreshInstagramTokenUseCase } from '../../application/use-cases/refresh-instagram-token.usecase';
import { StartInstagramConnectionUseCase } from '../../application/use-cases/start-instagram-connection.usecase';

import { INSTAGRAM_CALLBACK_PATH } from '../providers/instagram.provider';

const oauthCookie = 'service_b_instagram_oauth';

const cookieOptions = (): CookieOptions => ({
  httpOnly: true, sameSite: 'lax', secure: servicePublicUrl(INSTAGRAM_CALLBACK_PATH).protocol === 'https:',
  path: INSTAGRAM_CALLBACK_PATH,
});

@Controller('social-accounts')
export class SocialAccountController {
  constructor(
    private readonly startInstagramConnectionUseCase: StartInstagramConnectionUseCase,
    private readonly connectInstagramUseCase: ConnectInstagramUseCase,
    private readonly listSocialAccountsUseCase: ListSocialAccountsUseCase,
    private readonly refreshInstagramTokenUseCase: RefreshInstagramTokenUseCase,
  ) {}

  @Post('instagram/connect')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @Header('Cache-Control', 'no-store')
  async start (@Res({ passthrough: true }) res: Response) {
    const options = cookieOptions();
    const { authorizationUrl, nonce } = await this.startInstagramConnectionUseCase.execute();
    res.cookie(oauthCookie, nonce, { ...options, maxAge: 600_000 });
    return { authorizationUrl };
  }

  @Get('instagram/callback')
  @Header('Cache-Control', 'no-store')
  @Header('Referrer-Policy', 'no-referrer')
  async callback (@Query() dto: InstagramCallbackDto, @Headers('cookie') cookies: string | undefined, @Res({ passthrough: true }) res: Response) {
    const cookie = cookies?.split(';').map(value => value.trim()).find(value => value.startsWith(oauthCookie + '='));
    const account = await this.connectInstagramUseCase.execute(dto, cookie?.slice(oauthCookie.length + 1));
    res.clearCookie(oauthCookie, cookieOptions());
    return account;
  }

  @Get()
  @UseGuards(JwtAuthGuard, TenantGuard)
  list () {
    return this.listSocialAccountsUseCase.execute();
  }

  @Post(':id/instagram/refresh')
  @UseGuards(JwtAuthGuard, TenantGuard)
  refresh (@Param('id', ParseUUIDPipe) id: string) {
    return this.refreshInstagramTokenUseCase.execute(id);
  }
}
