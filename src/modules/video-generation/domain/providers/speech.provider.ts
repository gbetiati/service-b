// Voz sintetizada para a locução do anúncio. `style` descreve o tom de voz da marca, quando cadastrado.
export type SpeechRequest = { text: string; style?: string };

// Devolve o áudio falado em WAV, sem compressão, porque ainda vai ser cortado e mixado.
export abstract class SpeechProvider {
  abstract synthesize (request: SpeechRequest): Promise<Buffer>;
}
