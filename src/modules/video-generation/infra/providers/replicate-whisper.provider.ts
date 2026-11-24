import { Injectable } from '@nestjs/common';
import { httpsWebhookUrl, requiredEnv } from '@/shared/core/config';
import { AppError } from '@/shared/core/errors/app.error';
import { ExternalApiProvider } from '@/shared/libs/http/external-api.provider';
import { VideoTranscriptionProvider } from '../../domain/providers/video-transcription.provider';

const version = '8099696689d249cf8b122d833c36ac3f75505c666a395ca40ef26f68e7d3d16e';

@Injectable()
export class ReplicateWhisperProvider implements VideoTranscriptionProvider {
  constructor(private readonly externalApiProvider: ExternalApiProvider) {}

  async transcribe (submissionId: string, videoUrl: string) {
    const webhook = httpsWebhookUrl('/webhooks/replicate/transcription', 'da Replicate');
    requiredEnv('REPLICATE_WEBHOOK_SECRET');
    webhook.searchParams.set('submissionId', submissionId);
    const prediction = await this.externalApiProvider.json<{ id?: unknown } | null>('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + requiredEnv('REPLICATE_API_TOKEN'), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        version: 'openai/whisper:' + version,
        input: { audio: videoUrl, language: 'pt', translate: false, transcription: 'srt' },
        webhook: webhook.toString(),
        webhook_events_filter: ['completed'],
      }),
    });

    if (typeof prediction?.id !== 'string' || !prediction.id) {
      throw new AppError('upstream', 'Replicate não identificou a transcrição solicitada.');
    }
  }
}
