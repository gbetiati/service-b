import { Logger } from '@nestjs/common';
import { requiredEnv } from '@/shared/core/config';
import { AppError } from '@/shared/core/errors/app.error';
import { ExternalApiError, ExternalApiProvider } from '@/shared/libs/http/external-api.provider';
import { ConnectedAccount, ContainerStatus, SocialPlatformProvider, SocialToken } from '../../domain/providers/social-platform.provider';

// Endereço registrado na Meta para o retorno da autorização, nos dois tipos de login.
export const INSTAGRAM_CALLBACK_PATH = '/social-accounts/instagram/callback';

// Erro no formato da Meta: a Graph API usa { error: { message, type, code, error_subcode, fbtrace_id } } e a troca do
// código de autorização do Instagram usa { error_type, code, error_message }.
type MetaError = { message?: string; type?: string; code?: number; subcode?: number; traceId?: string };

// Códigos de erro da Meta com uma explicação útil para quem está conectando ou publicando.
const META_ERRORS: { codes: number[]; message: string }[] = [
  { codes: [190], message: 'O acesso ao Instagram expirou ou foi revogado. Conecte a conta novamente.' },
  { codes: [4, 17, 32, 613], message: 'O Instagram limitou as requisições. Tente novamente em alguns minutos.' },
  { codes: [10, 200], message: 'O Instagram negou a permissão. Autorize o acesso ao perfil e a publicação de conteúdo.' },
  { codes: [9004], message: 'O Instagram não conseguiu baixar o vídeo. Confira se a URL do vídeo é pública.' },
];

// Base dos dois tipos de login da Meta. A publicação de Reels (contêiner, status e publicação) é igual nos dois;
// muda só o host da Graph API e a forma de autorizar.
export abstract class MetaGraphProvider implements SocialPlatformProvider {
  protected readonly logger = new Logger(this.constructor.name);

  constructor(
    protected readonly externalApiProvider: ExternalApiProvider,
    private readonly host: string,
  ) {}

  abstract authorizationUrl (state: string): string;

  abstract connect (code: string): Promise<ConnectedAccount>;

  abstract refresh (accessToken: string): Promise<SocialToken>;

  // A Meta só aceita vídeo como REELS; share_to_feed=true faz o vídeo aparecer também no feed, além da aba Reels.
  createVideo (id: string, accessToken: string, videoUrl: string, caption: string) {
    return this.post(id, 'media', accessToken, { media_type: 'REELS', share_to_feed: 'true', video_url: videoUrl, caption });
  }

  async containerStatus (id: string, accessToken: string): Promise<ContainerStatus> {
    const { status_code } = await this.call<{ status_code: string }>(
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

  protected graphUrl (path: string, query: Record<string, string> = {}) {
    const url = new URL(this.host + '/' + graphVersion() + '/' + path);
    url.search = new URLSearchParams(query).toString();
    return url;
  }

  protected async call<T> (url: URL | string, init?: RequestInit): Promise<T> {
    try {
      return await this.externalApiProvider.json<T>(url, init);
    } catch (error) {
      if (!(error instanceof ExternalApiError)) throw error;

      const meta = metaError(error.body);
      // Só o caminho entra no log: a query pode carregar tokens e a chave do app.
      this.logger.warn(`Meta recusou a requisição. caminho=${new URL(url).pathname} status=${error.status} código=${meta.code ?? 'n/a'} subcódigo=${meta.subcode ?? 'n/a'} tipo=${meta.type ?? 'n/a'} fbtrace_id=${meta.traceId ?? 'n/a'} mensagem=${meta.message ?? 'n/a'}`);
      throw new AppError('upstream', explain(meta, error.status));
    }
  }

  protected headers (token: string) {
    return { Authorization: 'Bearer ' + token };
  }

  private async post (id: string, action: string, accessToken: string, form: Record<string, string>) {
    const result = await this.call<{ id?: string }>(this.graphUrl(encodeURIComponent(id) + '/' + action), {
      method: 'POST', headers: this.headers(accessToken), body: new URLSearchParams(form),
    });

    if (!result.id) throw new AppError('upstream', 'Instagram não retornou um identificador de mídia.');

    return result.id;
  }
}

export function graphVersion () {
  const version = requiredEnv('INSTAGRAM_GRAPH_VERSION');

  if (!/^v\d+\.\d+$/.test(version)) throw new AppError('unavailable', 'INSTAGRAM_GRAPH_VERSION inválida.');

  return version;
}

function metaError (body: unknown): MetaError {
  if (!body || typeof body !== 'object') return {};

  const record = body as Record<string, unknown>;
  const graph = record.error && typeof record.error === 'object' ? record.error as Record<string, unknown> : undefined;
  const text = (value: unknown) => typeof value === 'string' && value ? value.slice(0, 300) : undefined;
  const number = (value: unknown) => typeof value === 'number' ? value : undefined;
  return graph
    ? { message: text(graph.message), type: text(graph.type), code: number(graph.code), subcode: number(graph.error_subcode), traceId: text(graph.fbtrace_id) }
    : { message: text(record.error_message), type: text(record.error_type), code: number(record.code) };
}

function explain ({ message, code }: MetaError, status: number) {
  const known = META_ERRORS.find(item => code !== undefined && item.codes.includes(code));

  if (known) return known.message;

  if (message && /redirect_uri/i.test(message)) return 'A URL de retorno não confere com a registrada no app da Meta.';

  if (message && /invalid platform app/i.test(message)) {
    return 'O Instagram não reconheceu o app. Se a URL de login do painel da Meta começa com facebook.com e tem config_id (login unificado), defina INSTAGRAM_CONFIG_ID; senão, use em INSTAGRAM_APP_ID e INSTAGRAM_APP_SECRET o ID e a chave do app do Instagram.';
  }

  if (message && /client secret|access token signature/i.test(message)) return 'A chave secreta (INSTAGRAM_APP_SECRET) não confere com o ID do app (INSTAGRAM_APP_ID).';

  if (message && /authorization code|verification code|code has been used|code has expired/i.test(message)) return 'O código de autorização é inválido ou já foi usado. Conecte de novo.';

  if (status === 429) return META_ERRORS[1].message;

  return message ? `O Instagram recusou a requisição: ${message}` : `O Instagram recusou a requisição (HTTP ${status}).`;
}
