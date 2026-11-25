import { Injectable } from '@nestjs/common';
import { AppError } from '@/shared/core/errors/app.error';

// Tamanho máximo do corpo de erro guardado. Respostas de erro de APIs são pequenas; o limite protege a memória.
const MAX_ERROR_BODY = 4096;

// Resposta não 2xx de um serviço externo. Guarda o status e o corpo (JSON, quando possível) para o provider de cada
// serviço traduzir o erro. A mensagem continua genérica: só quem conhece o serviço sabe o que mostrar ao usuário.
export class ExternalApiError extends AppError {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super('upstream', 'Serviço externo retornou HTTP ' + status + '.');
  }
}

@Injectable()
export class ExternalApiProvider {
  async json<T> (url: URL | string, init?: RequestInit): Promise<T> {
    try {
      const response = await fetch(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(30_000) });

      if (!response.ok) throw new ExternalApiError(response.status, parse(await response.text().catch(() => '')));

      return await response.json() as T;
    } catch (error) {
      if (error instanceof AppError) throw error;

      throw new AppError('upstream', 'Falha na comunicação com o serviço externo.');
    }
  }
}

function parse (text: string) {
  const body = text.slice(0, MAX_ERROR_BODY);
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return body || undefined;
  }
}
