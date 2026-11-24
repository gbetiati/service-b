import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { Injectable, Logger } from '@nestjs/common';
import { Webhook } from 'standardwebhooks';

// Intervalos entre tentativas quando o destino não confirma o recebimento.
const RETRY_DELAYS_MS = [2_000, 10_000, 30_000, 60_000];
const REQUEST_TIMEOUT_MS = 180_000;

// Envia um evento assinado no formato Standard Webhooks e tenta de novo até receber 2xx. Usado nos avisos internos de trabalhos em background.
@Injectable()
export class SignedWebhookClient {
  private readonly logger = new Logger(SignedWebhookClient.name);
  protected wait = (ms: number) => sleep(ms);

  async send (url: URL, secret: string, event: object) {
    const payload = JSON.stringify(event);
    const webhook = new Webhook(secret);
    const messageId = 'msg_' + randomUUID();

    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      if (attempt > 0) await this.wait(RETRY_DELAYS_MS[attempt - 1]);

      const status = await this.post(url, webhook, messageId, payload);

      if (status !== null && status < 300) return true;

      this.logger.warn(`Webhook interno não confirmado. destino=${url.pathname} tentativa=${attempt + 1} status=${status ?? 'sem resposta'}`);
    }

    this.logger.error(`Webhook interno abandonado após ${RETRY_DELAYS_MS.length + 1} tentativas. destino=${url.pathname}`);
    return false;
  }

  private async post (url: URL, webhook: Webhook, messageId: string, payload: string) {
    const timestamp = new Date();
    try {
      const response = await fetch(url, {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: {
          'content-type': 'application/json',
          'webhook-id': messageId,
          'webhook-timestamp': String(Math.floor(timestamp.getTime() / 1000)),
          'webhook-signature': webhook.sign(messageId, timestamp, payload),
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
