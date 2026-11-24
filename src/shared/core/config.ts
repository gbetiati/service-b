import { AppError } from './errors/app.error';

export function requiredEnv (name: string): string {
  const value = process.env[name];

  if (!value) throw new AppError('unavailable', 'Configuração ausente: ' + name);

  return value;
}

export function servicePublicUrl (path: string): URL {
  const variable = process.env.NODE_ENV === 'production' ? 'PROD_SERVICE_BASE_URL' : 'SERVICE_BASE_URL';
  const base = requiredEnv(variable);

  if (!URL.canParse(base)) {
    throw new AppError('unavailable', variable + ' precisa ser uma URL absoluta.');
  }

  const url = new URL(base);

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new AppError('unavailable', variable + ' precisa usar HTTP ou HTTPS.');
  }

  return new URL(path, url);
}

// URL pública HTTPS para o provedor externo chamar o webhook. `provider` completa a mensagem, como "do Creatomate".
export function httpsWebhookUrl (path: string, provider: string): URL {
  const url = servicePublicUrl(path);

  if (url.protocol !== 'https:') throw new AppError('unavailable', 'A URL pública do serviço precisa usar HTTPS para o webhook ' + provider + '.');

  return url;
}
