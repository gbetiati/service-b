import { Injectable } from '@nestjs/common';
import { requiredEnv, servicePublicUrl } from '@/shared/core/config';
import { AppError } from '@/shared/core/errors/app.error';
import { ExternalApiProvider } from '@/shared/libs/http/external-api.provider';
import { graphVersion, INSTAGRAM_CALLBACK_PATH, MetaGraphProvider } from './meta-graph.provider';

type TokenResponse = { access_token?: string };
type GrantedScope = { scope?: string; target_ids?: string[] };
type DebugToken = { data?: { app_id?: string; is_valid?: boolean; expires_at?: number; scopes?: string[]; granular_scopes?: GrantedScope[] } };
type TokenInfo = { valid: boolean; expiresAt: Date | null; scopes: string[]; granular: GrantedScope[] };

const graph = 'https://graph.facebook.com';
const scopes = ['instagram_basic', 'instagram_content_publish'];
// O token do usuário de sistema da integração não vence. O vencimento guardado marca até quando o acesso foi conferido:
// a renovação automática confere de novo com a Meta e, se o acesso tiver sido revogado, a conta acaba desconectada.
const VALIDATION_WINDOW_MS = 60 * 86_400_000;

// Login unificado da API do Instagram (Login do Facebook para Empresas com uma configuração, INSTAGRAM_CONFIG_ID):
// autoriza em facebook.com com o ID do app da Meta e usa graph.facebook.com. A configuração define as contas e as
// permissões pedidas, e o token emitido costuma ser de um usuário de sistema da integração, que não vence.
@Injectable()
export class FacebookBusinessLoginProvider extends MetaGraphProvider {
  constructor(externalApiProvider: ExternalApiProvider) {
    super(externalApiProvider, graph);
  }

  authorizationUrl (state: string) {
    const url = new URL(`https://www.facebook.com/${graphVersion()}/dialog/oauth`);
    url.search = new URLSearchParams({
      client_id: requiredEnv('INSTAGRAM_APP_ID'), config_id: requiredEnv('INSTAGRAM_CONFIG_ID'), redirect_uri: servicePublicUrl(INSTAGRAM_CALLBACK_PATH).href,
      response_type: 'code', override_default_response_type: 'true', state,
    }).toString();
    return url.href;
  }

  async connect (code: string) {
    const app = { client_id: requiredEnv('INSTAGRAM_APP_ID'), client_secret: requiredEnv('INSTAGRAM_APP_SECRET') };
    let accessToken = await this.token({ ...app, redirect_uri: servicePublicUrl(INSTAGRAM_CALLBACK_PATH).href, code });
    let info = await this.inspect(accessToken);

    // Configuração que emite token de usuário: ele vence em horas e é trocado pelo de longa duração (cerca de 60 dias).
    if (info.expiresAt) {
      accessToken = await this.token({ ...app, grant_type: 'fb_exchange_token', fb_exchange_token: accessToken });
      info = await this.inspect(accessToken);
    }

    if (!info.valid) throw new AppError('upstream', 'A Meta não validou o acesso concedido. Conecte de novo.');

    if (info.scopes.length && !scopes.every(scope => info.scopes.includes(scope))) throw new AppError('invalid', 'Autorize o acesso ao perfil e a publicação de conteúdo.');

    const [externalId, ...others] = await this.instagramAccounts(accessToken, info);

    if (!externalId) throw new AppError('invalid', 'Nenhuma conta profissional do Instagram foi autorizada. Conecte de novo e selecione a conta do Instagram.');

    if (others.length) this.logger.log(`Mais de uma conta do Instagram autorizada; conectando a primeira. contas=${others.length + 1}`);

    const profile = await this.call<{ id?: string; username?: string; name?: string }>(
      this.graphUrl(encodeURIComponent(externalId), { fields: 'id,username,name' }), { headers: this.headers(accessToken) },
    );

    if (!profile.username) throw new AppError('upstream', 'A Meta não retornou o perfil profissional do Instagram.');

    return {
      accessToken, expiresAt: info.expiresAt ?? new Date(Date.now() + VALIDATION_WINDOW_MS),
      externalId, handle: profile.username, displayName: profile.name ?? null, scopes: info.scopes.length ? info.scopes : scopes,
    };
  }

  // Token que não vence: confere com a Meta que continua válido e estende a validação. Token de usuário não pode ser
  // renovado pelo servidor; é preciso conectar a conta de novo antes do vencimento.
  async refresh (accessToken: string) {
    const info = await this.inspect(accessToken);

    if (!info.valid) throw new AppError('upstream', 'O acesso ao Instagram expirou ou foi revogado. Conecte a conta novamente.');

    if (info.expiresAt) throw new AppError('conflict', 'Este tipo de acesso só é renovado conectando a conta de novo.');

    return { accessToken, expiresAt: new Date(Date.now() + VALIDATION_WINDOW_MS) };
  }

  private async token (params: Record<string, string>) {
    const result = await this.call<TokenResponse>(this.graphUrl('oauth/access_token', params));

    if (!result.access_token) throw new AppError('upstream', 'A Meta não retornou um token de acesso.');

    return result.access_token;
  }

  // Dados do token pela própria Meta (debug_token), com o token do app (ID|chave). Confere que o token é deste app.
  private async inspect (accessToken: string): Promise<TokenInfo> {
    const appId = requiredEnv('INSTAGRAM_APP_ID');
    const { data } = await this.call<DebugToken>(this.graphUrl('debug_token', { input_token: accessToken, access_token: appId + '|' + requiredEnv('INSTAGRAM_APP_SECRET') }));

    if (!data || data.app_id !== appId) throw new AppError('upstream', 'A Meta não confirmou que o token pertence a este app.');

    return {
      valid: data.is_valid === true, expiresAt: data.expires_at ? new Date(data.expires_at * 1000) : null,
      scopes: data.scopes ?? [], granular: data.granular_scopes ?? [],
    };
  }

  // Contas do Instagram autorizadas: as escolhidas no login (permissões por conta) ou, sem elas, as ligadas às páginas do usuário.
  private async instagramAccounts (accessToken: string, info: TokenInfo) {
    const granted = info.granular.filter(item => item.scope && scopes.includes(item.scope)).flatMap(item => item.target_ids ?? []);

    if (granted.length) return [...new Set(granted)];

    const { data: pages = [] } = await this.call<{ data?: { name?: string; instagram_business_account?: { id?: string } }[] }>(
      this.graphUrl('me/accounts', { fields: 'name,instagram_business_account' }), { headers: this.headers(accessToken) },
    );
    const accounts = [...new Set(pages.flatMap(page => page.instagram_business_account?.id ?? []))];

    if (accounts.length) return accounts;

    // Diagnóstico sem tokens: mostra se faltou permissão na configuração, a escolha da conta no login ou a ligação da página ao Instagram.
    const names = pages.map(page => page.name ?? 'sem nome').join(', ');
    this.logger.warn(`Nenhuma conta do Instagram autorizada. vence=${info.expiresAt ? 'sim' : 'não'} permissões=${info.scopes.join(',') || 'nenhuma'} por_conta=${info.granular.map(item => `${item.scope}:${item.target_ids?.length ?? 'sem_ids'}`).join(',') || 'nenhuma'} páginas=${pages.length}${names ? ` (${names})` : ''}`);

    // Página sem instagram_business_account: o Instagram não está ligado a ela, ou a Meta esconde o campo porque o acesso à Página
    // vem do portfólio empresarial (token de usuário de sistema) e a configuração não pede pages_read_engagement e business_management.
    if (pages.length) throw new AppError('invalid', `A Página do Facebook autorizada (${names}) não retornou uma conta profissional do Instagram. Confira se o Instagram está ligado a essa Página e conecte de novo.`);

    return [];
  }
}
