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

// URL de um webhook interno (avisos que a própria aplicação envia a si mesma). Por padrão, a instância local.
export function internalWebhookUrl (path: string): URL {
  const base = process.env.INTERNAL_WEBHOOK_BASE_URL?.trim() || `http://127.0.0.1:${process.env.PORT?.trim() || '3000'}`;
  return new URL(path, base);
}
