// Palavra reconhecida no áudio, com início e fim em segundos.
export type TimedWord = { text: string; start: number; end: number };

export type TranscriptionRequest = { audio: Buffer; language: string };

// Transcrição com o tempo de cada palavra. Usada para conferir a locução e achar onde cada trecho do roteiro começa.
export abstract class TranscriptionProvider {
  abstract transcribe (request: TranscriptionRequest): Promise<TimedWord[]>;
}
