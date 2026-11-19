import { Injectable } from '@nestjs/common';
import { requiredEnv } from '@/shared/core/config';
import { AppError } from '@/shared/core/errors/app.error';
import { ExternalApiProvider } from '../http/external-api.provider';

export type AiPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };

@Injectable()
export class OpenAiService {
  constructor(
    private readonly externalApiProvider: ExternalApiProvider,
  ) {}

  async complete(system: string, content: string | AiPart[], json = false)
  {
    const result = await this.externalApiProvider.json<{ choices?: { message?: { content?: string } }[] }>('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + requiredEnv('OPENAI_API_KEY'), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: requiredEnv('OPENAI_MODEL'), messages: [{ role: 'system', content: system }, { role: 'user', content }],
        ...(json ? { response_format: { type: 'json_object' } } : {}),
      }),
    });
    const text = result.choices?.[0]?.message?.content?.trim();
    if (!text) throw new AppError('upstream', 'A IA retornou uma resposta vazia.');
    return text;
  }
}
