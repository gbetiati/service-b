import { Module } from '@nestjs/common';
import { ExternalApiProvider } from './external-api.provider';
import { SignedWebhookClient } from './signed-webhook.client';

@Module({ providers: [ExternalApiProvider, SignedWebhookClient], exports: [ExternalApiProvider, SignedWebhookClient] })
export class ExternalApiModule {}
