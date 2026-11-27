import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import { request as httpRequest, type IncomingMessage } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { BlockList, isIP, type LookupFunction } from 'node:net';
import { AppError } from '@/shared/core/errors/app.error';

// Busca de URLs informadas por usuários (site da empresa, logo encontrado): só http/https nas portas padrão, sem
// usuário e senha na URL, e nunca para endereços internos. A checagem do IP acontece no momento da conexão, sobre o
// endereço já resolvido (o mesmo usado para conectar), o que também barra a troca de DNS entre checar e conectar.
// Cada redirecionamento passa pela mesma checagem. Tamanho e tempo são limitados.

export type SafeFetchOptions = { maxBytes?: number; timeoutMs?: number; maxRedirects?: number; accept?: RegExp };
export type SafeFetchResult = { url: string; contentType: string; body: Buffer };

const DEFAULTS = { maxBytes: 3 * 1024 * 1024, timeoutMs: 10_000, maxRedirects: 3 };
const USER_AGENT = 'Mozilla/5.0 (compatible; StudioOnboardingBot/1.0)';

// Faixas que não são internet pública: rede local, loopback, link-local (inclui o metadata de nuvem 169.254.169.254),
// CGNAT, multicast, reservadas e as equivalentes em IPv6.
const blocked = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24],
  ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) blocked.addSubnet(network, prefix, 'ipv4');
for (const [network, prefix] of [['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8], ['2001:db8::', 32], ['64:ff9b::', 96]] as const) blocked.addSubnet(network, prefix, 'ipv6');

export function isPublicAddress (address: string) {
  const family = isIP(address);

  if (!family) return false;

  // IPv4 escrito como IPv6 (::ffff:10.0.0.1) é checado como IPv4.
  const mapped = family === 6 ? /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)?.[1] : undefined;

  if (mapped) return !blocked.check(mapped, 'ipv4');

  return !blocked.check(address, family === 4 ? 'ipv4' : 'ipv6');
}

// URL aceitável para buscar: http(s), porta padrão, sem credenciais e com um host que não seja IP interno.
export function parsePublicUrl (raw: string, base?: string) {
  let url: URL;
  try {
    url = new URL(raw, base);
  } catch {
    throw new AppError('invalid', 'Informe um endereço válido, como https://www.suaempresa.com.br.');
  }

  if (!['http:', 'https:'].includes(url.protocol) || (url.port && !['80', '443'].includes(url.port)) || url.username || url.password) {
    throw new AppError('invalid', 'Use um endereço http ou https comum, sem porta nem usuário.');
  }

  const host = url.hostname.replace(/^\[|\]$/g, '');

  if (isIP(host) ? !isPublicAddress(host) : !host.includes('.') || /\.(local|internal|localhost)$/i.test(host) || host === 'localhost') {
    throw new AppError('invalid', 'Esse endereço não é um site público.');
  }

  url.hash = '';
  return url;
}

// Resolve o nome e recusa se algum endereço for interno. É o lookup usado na própria conexão.
export const publicOnlyLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, '', 0);

    const list = addresses as unknown as LookupAddress[];

    if (!list.length || list.some(({ address }) => !isPublicAddress(address))) {
      return callback(Object.assign(new Error('Endereço interno bloqueado.'), { code: 'EBLOCKED' }), '', 0);
    }

    if ((options as { all?: boolean }).all) return (callback as unknown as (e: null, a: LookupAddress[]) => void)(null, list);

    callback(null, list[0].address, list[0].family);
  });
};

function once (url: URL, timeoutMs: number) {
  return new Promise<IncomingMessage>((resolve, reject) => {
    const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)(url, {
      method: 'GET', lookup: publicOnlyLookup, timeout: timeoutMs,
      headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml,image/*;q=0.9,*/*;q=0.5', 'accept-language': 'pt-BR,pt;q=0.9' },
    }, resolve);
    request.on('timeout', () => request.destroy(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })));
    request.on('error', reject);
    request.end();
  });
}

export async function safeFetch (raw: string | URL, options: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const { maxBytes, timeoutMs, maxRedirects } = { ...DEFAULTS, ...options };
  const deadline = Date.now() + timeoutMs;
  let url = parsePublicUrl(String(raw));

  for (let redirects = 0; ; redirects++) {
    let response: IncomingMessage;
    try {
      response = await once(url, Math.max(1000, deadline - Date.now()));
    } catch (error) {
      const code = (error as { code?: string }).code;
      throw new AppError('upstream', code === 'EBLOCKED' ? 'Esse endereço não é um site público.' : code === 'ETIMEDOUT' ? 'O site demorou demais para responder.' : 'Não foi possível acessar o site.');
    }

    const status = response.statusCode ?? 0;

    if (status >= 300 && status < 400 && response.headers.location) {
      response.resume();

      if (redirects >= maxRedirects) throw new AppError('upstream', 'O site redireciona vezes demais.');

      url = parsePublicUrl(response.headers.location, url.toString());
      continue;
    }

    if (status < 200 || status >= 300) {
      response.resume();
      throw new AppError('upstream', `O site respondeu com erro (${status}).`);
    }

    const contentType = String(response.headers['content-type'] ?? '').toLowerCase();

    if (options.accept && !options.accept.test(contentType)) {
      response.resume();
      throw new AppError('upstream', 'O endereço não devolveu o tipo de conteúdo esperado.');
    }

    if (Number(response.headers['content-length'] ?? 0) > maxBytes) {
      response.resume();
      throw new AppError('upstream', 'O conteúdo do site é grande demais.');
    }

    const chunks: Buffer[] = [];
    let size = 0;
    try {
      for await (const chunk of response) {
        size += (chunk as Buffer).length;

        if (size > maxBytes) {
          response.destroy();
          throw new AppError('upstream', 'O conteúdo do site é grande demais.');
        }

        if (Date.now() > deadline) {
          response.destroy();
          throw new AppError('upstream', 'O site demorou demais para responder.');
        }

        chunks.push(chunk as Buffer);
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('upstream', 'A conexão com o site caiu.');
    }

    return { url: url.toString(), contentType, body: Buffer.concat(chunks) };
  }
}
