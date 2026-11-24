import { Injectable } from '@nestjs/common';
import { requiredEnv, servicePublicUrl } from '@/shared/core/config';
import { AppError } from '@/shared/core/errors/app.error';
import { ExternalApiProvider } from '@/shared/libs/http/external-api.provider';
import { ContainerStatus, SocialPlatformProvider } from '../../domain/providers/social-platform.provider';

type ShortToken = { access_token?: string; permissions?: string | string[] };
type LongToken = { access_token?: string; expires_in?: number };
export const INSTAGRAM_CALLBACK_PATH = '/social-accounts/instagram/callback';

const graph = 'https://graph.instagram.com';
const scopes = ['instagram_business_basic', 'instagram_business_content_publish'];

@Injectable()
export class InstagramProvider implements SocialPlatformProvider {
  constructor(
    private readonly externalApiProvider: ExternalApiProvider,
  ) {}

  authorizationUrl (state: string) {
    const url = new URL('https://www.instagram.com/oauth/authorize');
    url.search = new URLSearchParams({
      client_id: requiredEnv('INSTAGRAM_APP_ID'), redirect_uri: servicePublicUrl(INSTAGRAM_CALLBACK_PATH).href,
      response_type: 'code', scope: scopes.join(','), state, enable_fb_login: '0',
    }).toString();
    return url.href;
  }

  async connect (code: string) {
    const result = await this.externalApiProvider.json<ShortToken & { data?: ShortToken[] }>('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      body: new URLSearchParams({
        client_id: requiredEnv('INSTAGRAM_APP_ID'), client_secret: requiredEnv('INSTAGRAM_APP_SECRET'),
        grant_type: 'authorization_code', redirect_uri: servicePublicUrl(INSTAGRAM_CALLBACK_PATH).href, code,
      }),
    });
    const short = result.data?.[0] ?? result;

    if (!short.access_token) throw new AppError('upstream', 'Instagram não retornou um token de autorização.');

    const granted = typeof short.permissions === 'string' ? short.permissions.split(',').map(scope => scope.trim()) : short.permissions;

    if (granted && !scopes.every(scope => granted.includes(scope))) {
      throw new AppError('invalid', 'Autorize o acesso ao perfil e a publicação de conteúdo.');
    }

    const token = await this.longToken('/access_token', {
      grant_type: 'ig_exchange_token', client_secret: requiredEnv('INSTAGRAM_APP_SECRET'), access_token: short.access_token,
    });
    const me = await this.externalApiProvider.json<{ user_id?: string; id?: string; username?: string; name?: string }>(
      this.graphUrl('me', { fields: 'user_id,username,name' }), { headers: this.headers(token.accessToken) },
    );
    const externalId = me.user_id || me.id;

    if (!externalId || !me.username) throw new AppError('upstream', 'Instagram não retornou o perfil profissional.');

    return { ...token, externalId: String(externalId), handle: me.username, displayName: me.name ?? null, scopes: granted ?? scopes };
  }

  refresh (accessToken: string) {
    return this.longToken('/refresh_access_token', { grant_type: 'ig_refresh_token', access_token: accessToken });
  }

  createVideo (id: string, accessToken: string, videoUrl: string, caption: string) {
    return this.post(id, 'media', accessToken, { media_type: 'REELS', video_url: videoUrl, caption });
  }

  async containerStatus (id: string, accessToken: string): Promise<ContainerStatus> {
    const { status_code } = await this.externalApiProvider.json<{ status_code: string }>(
      this.graphUrl(encodeURIComponent(id), { fields: 'status_code' }), { headers: this.headers(accessToken) },
    );

    if (status_code === 'PUBLISHED') return 'published';

    if (status_code === 'FINISHED') return 'ready';

    if (['ERROR', 'EXPIRED'].includes(status_code)) return 'failed';

    return 'pending';
  }

  publish (id: string, containerId: string, accessToken: string) {
    return this.post(id, 'media_publish', accessToken, { creation_id: containerId });
  }

  private graphUrl (path: string, query: Record<string, string> = {}) {
    const version = requiredEnv('INSTAGRAM_GRAPH_VERSION');

    if (!/^v\d+\.\d+$/.test(version)) throw new AppError('unavailable', 'INSTAGRAM_GRAPH_VERSION inválida.');

    const url = new URL(graph + '/' + version + '/' + path);
    url.search = new URLSearchParams(query).toString();
    return url;
  }

  private async post (id: string, action: string, accessToken: string, form: Record<string, string>) {
    const result = await this.externalApiProvider.json<{ id?: string }> (
        this.graphUrl(encodeURIComponent(id) + '/' + action), {
        method: 'POST',
        headers: this.headers(accessToken),
        body: new URLSearchParams(form)
      });

    if (!result.id) throw new AppError('upstream', 'Instagram não retornou um identificador de mídia.');

    return result.id;
  }

  private async longToken (path: string, params: Record<string, string>) {
    const url = new URL(graph + path);
    url.search = new URLSearchParams(params).toString();
    const token = await this.externalApiProvider.json<LongToken>(url);

    if (!token.access_token || !Number.isFinite(token.expires_in) || token.expires_in! <= 0) {
      throw new AppError('upstream', 'Instagram não retornou um token de longa duração válido.');
    }

    return { accessToken: token.access_token, expiresAt: new Date(Date.now() + token.expires_in! * 1000) };
  }

  private headers (token: string) {
    return { Authorization: 'Bearer ' + token };
  }
}
