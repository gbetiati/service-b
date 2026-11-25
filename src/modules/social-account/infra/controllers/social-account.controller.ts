import { Body, Controller, Get, Header, HttpCode, Param, ParseUUIDPipe, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { frontendUrl } from '@/shared/core/config';
import { Authenticated } from '@/modules/identity/infra/guards/authenticated.decorator';
import { CompleteInstagramConnectionDto } from '../../application/dto/complete-instagram-connection.dto';
import { ConnectInstagramUseCase } from '../../application/use-cases/connect-instagram.usecase';
import { DisconnectSocialAccountUseCase } from '../../application/use-cases/disconnect-social-account.usecase';
import { ListSocialAccountsUseCase } from '../../application/use-cases/list-social-accounts.usecase';
import { RefreshInstagramTokenUseCase } from '../../application/use-cases/refresh-instagram-token.usecase';
import { StartInstagramConnectionUseCase } from '../../application/use-cases/start-instagram-connection.usecase';

// Página do frontend que recebe o retorno do Instagram e conclui a conexão com a sessão do usuário.
export const INSTAGRAM_FRONTEND_CALLBACK_PATH = '/social-accounts/instagram/callback';
// Parâmetros do retorno do Instagram repassados ao frontend, com tamanho máximo.
const FORWARDED_PARAMS: Record<string, number> = { state: 64, code: 4096, error: 160, error_reason: 160 };

@Controller('social-accounts')
export class SocialAccountController {
  constructor(
    private readonly startInstagramConnectionUseCase: StartInstagramConnectionUseCase,
    private readonly connectInstagramUseCase: ConnectInstagramUseCase,
    private readonly listSocialAccountsUseCase: ListSocialAccountsUseCase,
    private readonly refreshInstagramTokenUseCase: RefreshInstagramTokenUseCase,
    private readonly disconnectSocialAccountUseCase: DisconnectSocialAccountUseCase,
  ) {}

  // Devolve o link de autorização e o nonce, que o frontend guarda na aba até o retorno.
  @Post('instagram/connect')
  @Authenticated()
  @Header('Cache-Control', 'no-store')
  start () {
    return this.startInstagramConnectionUseCase.execute();
  }

  // Endereço registrado na Meta. Não conclui nada: só leva o retorno do Instagram para a página do frontend (FRONTEND_URL).
  @Get('instagram/callback')
  @Header('Cache-Control', 'no-store')
  @Header('Referrer-Policy', 'no-referrer')
  callback (@Query() query: Record<string, unknown>, @Res() res: Response) {
    const target = frontendUrl(INSTAGRAM_FRONTEND_CALLBACK_PATH);
    for (const [name, max] of Object.entries(FORWARDED_PARAMS)) {
      const value = query[name];

      if (typeof value === 'string' && value && value.length <= max) target.searchParams.set(name, value);
    }
    res.redirect(303, target.href);
  }

  @Post('instagram/callback')
  @Authenticated()
  @HttpCode(201)
  @Header('Cache-Control', 'no-store')
  complete (@Body() dto: CompleteInstagramConnectionDto) {
    return this.connectInstagramUseCase.execute(dto);
  }

  @Get()
  @Authenticated()
  list () {
    return this.listSocialAccountsUseCase.execute();
  }

  @Post(':id/instagram/refresh')
  @Authenticated()
  refresh (@Param('id', ParseUUIDPipe) id: string) {
    return this.refreshInstagramTokenUseCase.execute(id);
  }

  @Post(':id/disconnect')
  @Authenticated()
  @HttpCode(200)
  disconnect (@Param('id', ParseUUIDPipe) id: string) {
    return this.disconnectSocialAccountUseCase.execute(id);
  }
}
