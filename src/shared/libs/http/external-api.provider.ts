import { Injectable } from '@nestjs/common';
import { AppError } from '@/shared/core/errors/app.error';

@Injectable()
export class ExternalApiProvider {
  async json<T> (url: URL | string, init?: RequestInit): Promise<T> {
    try {
      const response = await fetch(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(30_000) });

      if (!response.ok) {
        await response.body?.cancel();
        throw new AppError('upstream', 'Serviço externo retornou HTTP ' + response.status + '.');
      }

      return await response.json() as T;
    } catch (error) {
      if (error instanceof AppError) throw error;

      throw new AppError('upstream', 'Falha na comunicação com o serviço externo.');
    }
  }
}
