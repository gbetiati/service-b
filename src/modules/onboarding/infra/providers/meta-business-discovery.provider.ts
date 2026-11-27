import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InstagramProfile, InstagramProfileProvider, InstagramUnavailableError } from '../../domain/providers/instagram-profile.provider';

const REQUEST_TIMEOUT_MS = 15_000;
const FIELDS = 'business_discovery.username({handle}){username,name,biography,website,profile_picture_url,followers_count,media.limit(12){caption}}';

type GraphError = { message?: string; code?: number; error_subcode?: number; fbtrace_id?: string };
type Discovery = { username?: string; name?: string; biography?: string; website?: string; profile_picture_url?: string; followers_count?: number; media?: { data?: { caption?: string }[] } };

// Perfil público pelo @, com a API oficial da Meta (Business Discovery): a consulta parte de uma conta profissional da
// própria plataforma (INSTAGRAM_DISCOVERY_ACCOUNT_ID, com o token em INSTAGRAM_DISCOVERY_TOKEN, de preferência de um
// usuário do sistema do Business Manager, que não expira). Só lê contas comerciais ou de criador. O app da Meta precisa
// das permissões instagram_basic, instagram_manage_insights e pages_read_engagement, pelo login do Facebook.
@Injectable()
export class MetaBusinessDiscoveryProvider implements InstagramProfileProvider {
  private readonly logger = new Logger(MetaBusinessDiscoveryProvider.name);

  constructor(
    private readonly config: ConfigService,
  ) {}

  async find (handle: string): Promise<InstagramProfile | null> {
    const accountId = this.config.get<string>('INSTAGRAM_DISCOVERY_ACCOUNT_ID')?.trim();
    const token = this.config.get<string>('INSTAGRAM_DISCOVERY_TOKEN')?.trim();

    if (!accountId || !token) throw new InstagramUnavailableError('A leitura do Instagram pelo @ ainda não está configurada; a análise usou só o site.');

    const version = this.config.get<string>('INSTAGRAM_GRAPH_VERSION')?.trim() || 'v27.0';
    const url = new URL(`https://graph.facebook.com/${version}/${encodeURIComponent(accountId)}`);
    url.searchParams.set('fields', FIELDS.replace('{handle}', handle));

    let response: Response;
    try {
      response = await fetch(url, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), redirect: 'error' });
    } catch {
      throw new InstagramUnavailableError(`Não foi possível consultar o Instagram @${handle} agora.`);
    }

    const body = await response.json().catch(() => ({})) as { business_discovery?: Discovery; error?: GraphError };

    if (body.error) return this.handleError(handle, body.error);

    const profile = body.business_discovery;

    if (!profile?.username) return null;

    return {
      username: profile.username, name: profile.name ?? null, biography: profile.biography ?? null, website: profile.website ?? null,
      profilePictureUrl: profile.profile_picture_url ?? null, followers: profile.followers_count ?? null,
      captions: (profile.media?.data ?? []).map(media => media.caption?.trim() ?? '').filter(Boolean).slice(0, 12),
    };
  }

  private handleError (handle: string, error: GraphError): null {
    // Só o código do erro vai para o log, nunca o token.
    this.logger.warn(`Business Discovery recusou. código=${error.code ?? 'n/a'} subcódigo=${error.error_subcode ?? 'n/a'} trace=${error.fbtrace_id ?? 'n/a'}`);

    // Conta inexistente, pessoal ou com restrição de idade: não há perfil profissional para ler.
    if (error.code === 110 || error.error_subcode === 2207013) return null;

    if (error.code === 10 || error.code === 200 || (error.code ?? 0) >= 200 && (error.code ?? 0) < 300) {
      throw new InstagramUnavailableError('O app da Meta ainda não tem permissão para ler perfis pelo @ (Business Discovery); a análise usou só o site.');
    }

    if (error.code === 190) throw new InstagramUnavailableError('A credencial usada para ler o Instagram expirou; a análise usou só o site.');

    if (error.code === 4 || error.code === 17 || error.code === 32 || error.code === 613) throw new InstagramUnavailableError('O Instagram limitou as consultas no momento; a análise usou só o site.');

    throw new InstagramUnavailableError(`Não foi possível ler o Instagram @${handle}.`);
  }
}
