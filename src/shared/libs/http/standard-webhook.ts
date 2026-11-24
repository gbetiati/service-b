import type { Request } from 'express';
import type { WebhookUnbrandedRequiredHeaders } from 'standardwebhooks';

export function standardWebhookHeaders (request: Request): WebhookUnbrandedRequiredHeaders {
  return {
    'webhook-id': request.header('webhook-id') ?? '',
    'webhook-timestamp': request.header('webhook-timestamp') ?? '',
    'webhook-signature': request.header('webhook-signature') ?? '',
  };
}
