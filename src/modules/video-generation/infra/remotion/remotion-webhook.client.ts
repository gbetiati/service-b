import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { Injectable, Logger } from '@nestjs/common';
import { Webhook } from 'standardwebhooks';
// TESTE (mock): reative junto com a assinatura.
// import { requiredEnv } from '@/shared/core/config';
import { RemotionSettings } from './remotion.settings';

export type RemotionRenderEvent = { submissionId: string; providerId: string } & ({ status: 'succeeded'; storageKey: string } | { status: 'failed' });

// Intervalos entre tentativas. A conclusão inclui a revisão automática do vídeo, que pode levar mais de um minuto.
const RETRY_DELAYS_MS = [2_000, 10_000, 30_000, 60_000];
const REQUEST_TIMEOUT_MS = 180_000;

// Avisa o fim do render no mesmo formato assinado (Standard Webhooks) usado pela Replicate.
@Injectable()
export class RemotionWebhookClient {
  private readonly logger = new Logger(RemotionWebhookClient.name);
  protected wait = (ms: number) => sleep(ms);

  constructor(
    private readonly settings: RemotionSettings,
  ) {}

  async send (event: RemotionRenderEvent) {
    const payload = JSON.stringify(event);
    // TESTE (mock): assinatura comentada; o webhook é enviado sem assinar.
    // const webhook = new Webhook(requiredEnv('REMOTION_WEBHOOK_SECRET'));
    const webhook = null;
    const messageId = 'msg_' + randomUUID();

    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      if (attempt > 0) await this.wait(RETRY_DELAYS_MS[attempt - 1]);

      const status = await this.post(webhook, messageId, payload);

      if (status !== null && status < 300) return true;

      this.logger.warn(`Webhook do Remotion não confirmado. providerId=${event.providerId} tentativa=${attempt + 1} status=${status ?? 'sem resposta'}`);
    }

    this.logger.error(`Webhook do Remotion abandonado após ${RETRY_DELAYS_MS.length + 1} tentativas. providerId=${event.providerId}`);
    return false;
  }

  private async post (webhook: Webhook | null, messageId: string, payload: string) {
    const timestamp = new Date();
    try {
      const response = await fetch(this.settings.webhookUrl, {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: {
          'content-type': 'application/json',
          'webhook-id': messageId,
          'webhook-timestamp': String(Math.floor(timestamp.getTime() / 1000)),
          // TESTE (mock): assinatura comentada.
          'webhook-signature': webhook?.sign(messageId, timestamp, payload) ?? '',
        },
        body: payload,
      });
      await response.body?.cancel();
      return response.status;
    } catch {
      return null;
    }
  }
}
