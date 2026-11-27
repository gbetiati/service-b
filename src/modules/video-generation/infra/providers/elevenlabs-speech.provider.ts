import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { requiredEnv } from '@/shared/core/config';
import { AppError } from '@/shared/core/errors/app.error';
import { AlignedTake, SpeechProvider, SpeechRequest } from '../../domain/providers/speech.provider';

const API_URL = 'https://api.elevenlabs.io/v1/text-to-speech';
const REQUEST_TIMEOUT_MS = 60_000;
// O roteiro inteiro (tomada única) tem poucas centenas de caracteres; o limite protege contra uso indevido.
const MAX_INPUT_LENGTH = 500;
// MP3 a 44,1 kHz, o mesmo do playground: mais nítido que o PCM a 24 kHz. O FFmpeg lê o MP3 para cortar e mixar.
const OUTPUT_FORMAT = 'mp3_44100_128';
// Ajustes padrão da voz, os mesmos aprovados no playground da ElevenLabs (modelo Eleven v3): estabilidade 50% ("Natural",
// entre Creative e Robust) e similaridade 75%. Estilo em zero: exagero de estilo deixa a voz mais teatral e com risadas.
const DEFAULT_SETTINGS = { stability: 0.5, similarity: 0.75, style: 0 };
// Modelos que aceitam as frases vizinhas como contexto (o Eleven v3 recusa previous_text/next_text) e o idioma explícito.
const supportsContext = (model: string) => !model.startsWith('eleven_v3');
const supportsLanguage = (model: string) => model.startsWith('eleven_v3') || /^eleven_(flash|turbo)_v2_5/.test(model);

type Fetch = typeof fetch;
type Alignment = { characters?: string[]; character_start_times_seconds?: number[]; character_end_times_seconds?: number[] };

// Locução pela API de texto para fala da ElevenLabs. A voz (ELEVENLABS_VOICE_ID) define timbre e estilo: diferente da
// OpenAI, a ElevenLabs não recebe instruções em texto, então o tom de voz da marca (`style`) não entra no pedido.
// O roteiro vai inteiro numa chamada, como no playground (POST .../with-timestamps): a entonação liga uma frase à outra
// e a ElevenLabs devolve o tempo de cada caractere, que dá o ponto exato de corte entre as frases. Nada de pausas
// forçadas: em testes, <break>, reticências e quebras de linha viraram sílabas sem sentido no lugar do silêncio. A fala
// fica na velocidade natural (tempo 1): a aceleração padrão foi calibrada para a OpenAI e deixava esta voz apressada.
@Injectable()
export class ElevenLabsSpeechProvider implements SpeechProvider {
  // A tomada única com corte por silêncio não serve aqui (não há pausa longa entre as frases); o corte vem do
  // alinhamento de synthesizeTake. Se ele falhar, cada frase vai numa chamada.
  readonly singleTake = false;
  readonly audioFormat = 'mp3';
  readonly tempo = 1;
  private readonly logger = new Logger(ElevenLabsSpeechProvider.name);
  protected fetch: Fetch = (input, init) => fetch(input, init);

  constructor(
    private readonly config: ConfigService,
  ) {}

  async synthesize ({ text, previousText, nextText }: SpeechRequest) {
    const input = this.validText(text);
    const model = this.model();
    const response = await this.post('', {
      ...this.body(input),
      ...(supportsContext(model) && previousText?.trim() && { previous_text: speakable(previousText) }),
      ...(supportsContext(model) && nextText?.trim() && { next_text: speakable(nextText) }),
    });
    const audio = Buffer.from(await response.arrayBuffer());

    if (!audio.length) throw new AppError('upstream', 'O serviço de locução devolveu um áudio vazio.');

    return audio;
  }

  async synthesizeTake (lines: string[]): Promise<AlignedTake> {
    const spoken = lines.map(speakable);
    const text = this.validText(spoken.join(' '));
    const response = await this.post('/with-timestamps', this.body(text));
    const { audio_base64: audioBase64, alignment } = await response.json() as { audio_base64?: string; alignment?: Alignment };
    const audio = Buffer.from(audioBase64 ?? '', 'base64');

    if (!audio.length) throw new AppError('upstream', 'O serviço de locução devolveu um áudio vazio.');

    return { audio, cuts: lineCuts(spoken, alignment) };
  }

  private validText (text: string) {
    const input = text.trim();

    if (!input || input.length > MAX_INPUT_LENGTH) throw new AppError('invalid', 'O texto da locução precisa ter entre 1 e 500 caracteres.');

    return input;
  }

  private model () {
    return this.config.get<string>('ELEVENLABS_MODEL')?.trim() || 'eleven_multilingual_v2';
  }

  private body (text: string) {
    const model = this.model();
    return {
      text: speakable(text),
      model_id: model,
      ...(supportsLanguage(model) && { language_code: this.config.get<string>('ELEVENLABS_LANGUAGE')?.trim() || 'pt' }),
      voice_settings: {
        stability: this.ratio('ELEVENLABS_STABILITY', DEFAULT_SETTINGS.stability),
        similarity_boost: this.ratio('ELEVENLABS_SIMILARITY', DEFAULT_SETTINGS.similarity),
        style: this.ratio('ELEVENLABS_STYLE', DEFAULT_SETTINGS.style),
        use_speaker_boost: true,
      },
    };
  }

  // Valor de 0 a 1 do .env (ex.: ELEVENLABS_STABILITY=0.5); fora disso, o padrão.
  private ratio (name: string, fallback: number) {
    const raw = this.config.get<string>(name)?.trim();
    const value = Number(raw);
    return raw && Number.isFinite(value) && value >= 0 && value <= 1 ? value : fallback;
  }

  private async post (path: string, body: object) {
    const url = new URL(`${API_URL}/${encodeURIComponent(requiredEnv('ELEVENLABS_VOICE_ID'))}${path}`);
    url.searchParams.set('output_format', OUTPUT_FORMAT);

    let response: Response;
    try {
      response = await this.fetch(url, {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: { 'xi-api-key': requiredEnv('ELEVENLABS_API_KEY'), 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch {
      throw new AppError('upstream', 'Falha na comunicação com o serviço de locução.');
    }

    if (!response.ok) {
      // Só os códigos do erro da ElevenLabs vão para o log (ex.: quota_exceeded, paid_plan_required), nunca o corpo inteiro.
      const detail = await response.json().then((json: { detail?: { status?: unknown; code?: unknown } }) => json?.detail ?? {}).catch(() => ({} as { status?: unknown; code?: unknown }));
      const code = String(detail.code ?? detail.status ?? 'n/a').slice(0, 60);
      this.logger.warn(`ElevenLabs TTS respondeu com erro. status=${response.status} code=${code} requestId=${response.headers.get('request-id') ?? 'n/a'}`);
      throw new AppError('upstream', explain(response.status, code));
    }

    return response;
  }
}

// Ponto de corte entre cada frase e a seguinte: o meio do intervalo entre o último caractere de uma e o primeiro da
// outra. O texto falado é a junção das frases com um espaço, então a posição de cada uma no alinhamento é conhecida.
// Se o alinhamento não bater com o texto (por exemplo, normalizado pela ElevenLabs), o corte não é confiável.
export function lineCuts (lines: string[], alignment?: Alignment) {
  const characters = alignment?.characters ?? [];
  const starts = alignment?.character_start_times_seconds ?? [];
  const ends = alignment?.character_end_times_seconds ?? [];

  if (characters.join('') !== lines.join(' ') || starts.length !== characters.length || ends.length !== characters.length) {
    throw new AppError('upstream', 'A ElevenLabs não devolveu o tempo de cada trecho da locução.');
  }

  const cuts: number[] = [];
  let offset = 0;
  for (let index = 0; index < lines.length - 1; index++) {
    const lastOfLine = offset + lines[index].length - 1;
    const firstOfNext = lastOfLine + 2;
    cuts.push(Number(((ends[lastOfLine] + starts[firstOfNext]) / 2).toFixed(3)));
    offset = firstOfNext;
  }

  return cuts;
}

// Texto que vai para a voz. A exclamação vira ponto: o Eleven v3 tende a rir ou exagerar em frases com "!" e tom de
// humor (o texto na tela continua com a exclamação). Risadas escritas (haha, kkk, rs) saem, para não serem lidas nem
// interpretadas como riso. Quebras de linha viram espaço.
export function speakable (text: string) {
  return text
    .replace(/\b(?:ha){2,}h?\b|\bk{3,}\b|\brs(?:rs)*\b/gi, ' ')
    .replace(/[!¡]+/g, '.')
    .replace(/\?\./g, '?')
    .replace(/\.{2,}/g, '.')
    .replace(/\s*\n+\s*/g, ' ')
    .replace(/\s+([.,?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function explain (status: number, code: string) {
  // O plano gratuito só usa as vozes padrão da conta pela API; vozes da biblioteca (como as em português) pedem plano pago.
  if (code === 'paid_plan_required') return 'A voz escolhida (ELEVENLABS_VOICE_ID) é da biblioteca da ElevenLabs e só pode ser usada pela API num plano pago.';

  if (code === 'concurrent_limit_exceeded') return 'A ElevenLabs recusou por excesso de locuções ao mesmo tempo (limite de chamadas simultâneas do plano). Tente de novo em instantes.';

  if (status === 429 || code === 'quota_exceeded') return 'O serviço de locução recusou o pedido por limite de uso ou falta de créditos.';

  if (status === 401) return 'A chave da ElevenLabs (ELEVENLABS_API_KEY) foi recusada.';

  return 'O serviço de locução não gerou o áudio.';
}
