import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { requiredEnv } from '@/shared/core/config';
import { AppError } from '@/shared/core/errors/app.error';
import { TranscriptionProvider, TranscriptionRequest } from '../../domain/providers/transcription.provider';

const TRANSCRIPTION_URL = 'https://api.openai.com/v1/audio/transcriptions';
const REQUEST_TIMEOUT_MS = 60_000;
// Limite da API para o arquivo enviado.
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

const ResponseSchema = z.object({ words: z.array(z.object({ word: z.string(), start: z.number(), end: z.number() })) });

type Fetch = typeof fetch;

// Transcrição pela API da OpenAI (POST /v1/audio/transcriptions) com o tempo de cada palavra. Só o whisper-1 devolve
// esse tempo (timestamp_granularities); a OpenAI anunciou o desligamento dele para 26/02/2027, sem substituto com
// esse recurso até agora. Sem ele, a locução volta a ser gravada trecho a trecho.
@Injectable()
export class OpenAiTranscriptionProvider implements TranscriptionProvider {
  private readonly logger = new Logger(OpenAiTranscriptionProvider.name);
  protected fetch: Fetch = (input, init) => fetch(input, init);

  constructor(
    private readonly config: ConfigService,
  ) {}

  async transcribe ({ audio, language }: TranscriptionRequest) {
    if (!audio.length || audio.length > MAX_AUDIO_BYTES) throw new AppError('invalid', 'O áudio para transcrição precisa ter entre 1 byte e 25 MB.');

    const apiKey = requiredEnv('OPENAI_API_KEY');
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(audio)], { type: 'audio/wav' }), 'voice.wav');
    form.append('model', this.config.get<string>('OPENAI_TRANSCRIBE_MODEL')?.trim() || 'whisper-1');
    form.append('language', language);
    form.append('response_format', 'verbose_json');
    form.append('timestamp_granularities[]', 'word');

    let response: Response;
    try {
      response = await this.fetch(TRANSCRIPTION_URL, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), headers: { authorization: `Bearer ${apiKey}` }, body: form,
      });
    } catch {
      throw new AppError('upstream', 'Falha na comunicação com o serviço de transcrição.');
    }

    if (!response.ok) {
      const code = await response.json().then((body: { error?: { code?: unknown } }) => String(body?.error?.code ?? 'n/a').slice(0, 60)).catch(() => 'n/a');
      this.logger.warn(`OpenAI transcrição respondeu com erro. status=${response.status} code=${code} requestId=${response.headers.get('x-request-id') ?? 'n/a'}`);
      throw new AppError('upstream', 'O serviço de transcrição não transcreveu o áudio.');
    }

    const result = ResponseSchema.safeParse(await response.json().catch(() => null));

    if (!result.success) throw new AppError('upstream', 'O serviço de transcrição devolveu as palavras sem o tempo de cada uma.');

    return result.data.words.map(({ word, start, end }) => ({ text: word, start, end }));
  }
}
