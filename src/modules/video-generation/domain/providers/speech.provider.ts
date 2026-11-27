// Voz sintetizada para a locução do anúncio. `style` descreve o tom de voz da marca, quando cadastrado.
// `previousText` e `nextText` são as frases vizinhas quando cada frase é gravada numa chamada: o serviço que aceita
// usa como contexto, para a entonação seguir como numa leitura contínua.
export type SpeechRequest = { text: string; style?: string; previousText?: string; nextText?: string };

// Roteiro inteiro gravado numa tomada só, com o tempo (em segundos) do ponto de corte entre cada frase e a seguinte,
// dado pelo próprio serviço de voz (alinhamento de cada caractere falado). `cuts` tem uma posição a menos que as frases.
export type AlignedTake = { audio: Buffer; cuts: number[] };

// Devolve o áudio falado (WAV ou MP3, conforme `audioFormat`), que ainda vai ser cortado e mixado no FFmpeg.
export abstract class SpeechProvider {
  // Se o serviço grava bem o roteiro inteiro numa tomada só, com pausa clara entre as frases (que é onde a tomada é
  // cortada). Quando não grava, cada frase vai numa chamada, com as vizinhas como contexto.
  readonly singleTake: boolean = true;
  // Formato do áudio devolvido, que vira a extensão do arquivo temporário.
  readonly audioFormat: 'wav' | 'mp3' = 'wav';
  // Aceleração aplicada no FFmpeg depois da gravação. Sem valor, a padrão (VOICE_TEMPO); 1 mantém a velocidade natural.
  readonly tempo?: number;

  abstract synthesize (request: SpeechRequest): Promise<Buffer>;

  // Tomada única com os pontos de corte entre as frases, quando o serviço informa o tempo de cada caractere: a fala sai
  // natural, sem pausas forçadas, e o corte não depende de detectar silêncio nem de transcrever o áudio.
  synthesizeTake? (lines: string[], style?: string): Promise<AlignedTake>;
}
