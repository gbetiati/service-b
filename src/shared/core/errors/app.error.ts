export type ErrorKind = 'invalid' | 'unauthorized' | 'missing' | 'conflict' | 'upstream' | 'unavailable';

export class AppError extends Error {
  constructor(
    readonly kind: ErrorKind,
    message: string,
  ) { super(message); }
}

export function requireRecord<T>(value: T | null | undefined, label: string): T {
  if (value == null) throw new AppError('missing', label + ' não encontrado.');
  return value;
}
