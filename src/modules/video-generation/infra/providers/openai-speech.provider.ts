import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { requiredEnv } from '@/shared/core/config';
import { AppError } from '@/shared/core/errors/app.error';
import { SpeechProvider, SpeechRequest } from '../../domain/providers/speech.provider';

const SPEECH_URL = 'https://api.openai.com/v1/audio/speech';
const REQUEST_TIMEOUT_MS = 60_000;
// O roteiro inteiro (tomada única) tem poucas centenas de caracteres; o limite protege contra uso indevido.
const MAX_INPUT_LENGTH = 500;

// O gpt-4o-mini-tts controla ritmo e estilo pelas instruções, não por um parâmetro de velocidade. Um aspecto por linha,
// em inglês (o modelo é otimizado para inglês), sem pedir pressa: a aceleração final é feita no FFmpeg (VOICE_TEMPO),
// que é mais previsível. A pausa entre as frases é necessária para separar os trechos da tomada única.
const BASE_INSTRUCTIONS = [
  'Language: Native Brazilian Portuguese (São Paulo accent), never European Portuguese.',
  'Voice Affect: Warm, bright and confident, like a professional radio ad announcer.',
  'Tone: Friendly and persuasive, smiling while speaking, close to the listener.',
  'Pacing: Lively and dynamic but always clear; never rushed or swallowing syllables.',
  'Emotion: Genuine enthusiasm, not exaggerated or cartoonish.',
  'Emphasis: Stress the product benefit and the call to action.',
  'Pauses: A brief, clear pause after each sentence; no silence at the start or end.',
].join('\n');

type Fetch = typeof fetch;

// Locução pela API de texto para fala da OpenAI (POST /v1/audio/speech). Modelo e voz são configuráveis. A OpenAI
// anunciou o desligamento do gpt-4o-mini-tts e do tts-1 para 06/01/2027; o substituto (gpt-realtime-2.1-mini) só
// funciona pela Realtime API, que exige um novo provider. Áudio em WAV: ainda vai ser cortado e mixado.
@Injectable()
export class OpenAiSpeechProvider implements SpeechProvider {
  readonly singleTake = true;
  readonly audioFormat = 'wav';
  private readonly logger = new Logger(OpenAiSpeechProvider.name);
  protected fetch: Fetch = (input, init) => fetch(input, init);

  constructor(
    private readonly config: ConfigService,
  ) {}

  async synthesize ({ text, style }: SpeechRequest) {
    const input = text.trim();

    if (!input || input.length > MAX_INPUT_LENGTH) throw new AppError('invalid', 'O texto da locução precisa ter entre 1 e 500 caracteres.');

    const apiKey = requiredEnv('OPENAI_API_KEY');
    const model = this.config.get<string>('OPENAI_TTS_MODEL')?.trim() || 'gpt-4o-mini-tts';
    const voice = this.config.get<string>('OPENAI_TTS_VOICE')?.trim() || 'ash';
    // O tom da marca ajusta o estilo, sem mudar o ritmo nem as pausas, das quais depende a separação dos trechos.
    const instructions = style?.trim() ? `${BASE_INSTRUCTIONS}\nBrand style (adjust tone only, keep pacing and pauses above): ${style.trim()}` : BASE_INSTRUCTIONS;

    let response: Response;
    try {
      response = await this.fetch(SPEECH_URL, {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model, voice, input, instructions, response_format: 'wav' }),
      });
    } catch {
      throw new AppError('upstream', 'Falha na comunicação com o serviço de locução.');
    }

    if (!response.ok) {
      // Só o código do erro vai para o log (ex.: insufficient_quota quando a conta está sem créditos), nunca o corpo inteiro.
      const code = await response.json().then((body: { error?: { code?: unknown } }) => String(body?.error?.code ?? 'n/a').slice(0, 60)).catch(() => 'n/a');
      this.logger.warn(`OpenAI TTS respondeu com erro. status=${response.status} code=${code} requestId=${response.headers.get('x-request-id') ?? 'n/a'}`);
      throw new AppError('upstream', response.status === 429 ? 'O serviço de locução recusou o pedido por limite de uso ou falta de créditos.' : 'O serviço de locução não gerou o áudio.');
    }

    const audio = Buffer.from(await response.arrayBuffer());

    if (!audio.length) throw new AppError('upstream', 'O serviço de locução devolveu um áudio vazio.');

    return audio;
  }
}
