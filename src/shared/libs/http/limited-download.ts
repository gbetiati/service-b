import { Readable } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { AppError } from '@/shared/core/errors/app.error';

export type LimitedDownloadOptions = { maxBytes: number; timeoutMs: number; invalidMessage: string; oversizedMessage: string };

// Baixa por streaming, sem carregar o arquivo inteiro na memória, e interrompe quando o limite de bytes é excedido.
export async function downloadLimited (url: URL, { maxBytes, timeoutMs, invalidMessage, oversizedMessage }: LimitedDownloadOptions): Promise<Readable> {
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(timeoutMs) });

  if (!response.ok || !response.body || Number(response.headers.get('content-length')) > maxBytes) {
    await response.body?.cancel();
    throw new AppError('upstream', invalidMessage);
  }

  const body = Readable.fromWeb(response.body as NodeReadableStream<Uint8Array>);
  return Readable.from(limit(body, maxBytes, oversizedMessage));
}

async function* limit (body: Readable, maxBytes: number, oversizedMessage: string) {
  let total = 0;
  for await (const chunk of body) {
    total += chunk.length;

    if (total > maxBytes) throw new AppError('upstream', oversizedMessage);

    yield chunk as Buffer;
  }
}

export function isPlainHttpsUrl (url: URL) {
  return url.protocol === 'https:' && !url.port && !url.username && !url.password;
}
