import { Module } from '@nestjs/common';
import { ExternalApiModule } from '../http/external-api.module';
import { OpenAiService } from './open-ai.service';

@Module({ imports: [ExternalApiModule], providers: [OpenAiService], exports: [OpenAiService] })
export class AiModule {}
