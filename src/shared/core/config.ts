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
