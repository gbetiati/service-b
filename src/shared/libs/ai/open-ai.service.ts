import { Injectable } from '@nestjs/common';
import { requiredEnv } from '@/shared/core/config';
import { AppError } from '@/shared/core/errors/app.error';
import { ExternalApiProvider } from '../http/external-api.provider';

export type AiPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };

type BackgroundResponse = {
  id?: string;
  status?: string;
  metadata?: Record<string, string>;
  output?: { type: string; content?: { type: string; text?: string }[] }[];
};

const responsesUrl = 'https://api.openai.com/v1/responses';

@Injectable()
export class OpenAiService {
  constructor(
    private readonly externalApiProvider: ExternalApiProvider,
  ) {}

  async complete (system: string, content: string | AiPart[], json = false) {
    const result = await this.externalApiProvider.json<{ choices?: { message?: { content?: string } }[] }>('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        model: requiredEnv('OPENAI_MODEL'), messages: [{ role: 'system', content: system }, { role: 'user', content }],
        ...(json ? { response_format: { type: 'json_object' } } : {}),
      }),
    });
    const text = result.choices?.[0]?.message?.content?.trim();

    if (!text) throw new AppError('upstream', 'A IA retornou uma resposta vazia.');

    return text;
  }

  async startBackgroundResponse (instructions: string, input: string, metadata: Record<string, string>) {
    const response = await this.externalApiProvider.json<BackgroundResponse>(responsesUrl, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ model: requiredEnv('OPENAI_MODEL'), instructions, input, background: true, store: true, metadata }),
    });

    if (!response.id) throw new AppError('upstream', 'A IA não identificou a solicitação de roteiro.');
  }

  retrieveBackgroundResponse (responseId: string) {
    return this.externalApiProvider.json<BackgroundResponse>(responsesUrl + '/' + encodeURIComponent(responseId), {
      headers: this.headers(),
    });
  }

  private headers () {
    return { Authorization: 'Bearer ' + requiredEnv('OPENAI_API_KEY'), 'Content-Type': 'application/json' };
  }
}
