import { Module } from '@nestjs/common';
import { ExternalApiProvider } from './external-api.provider';

@Module({ providers: [ExternalApiProvider], exports: [ExternalApiProvider] })
export class ExternalApiModule {}
