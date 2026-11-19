import { AppError } from './errors/app.error';

export function requiredEnv (name: string): string {
  const value = process.env[name];

  if (!value) throw new AppError('unavailable', 'Configuração ausente: ' + name);

  return value;
}
