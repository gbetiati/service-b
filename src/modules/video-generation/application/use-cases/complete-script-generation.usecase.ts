import { Injectable } from '@nestjs/common';
import type { ScriptResult } from '@/modules/content/domain/providers/script.provider';
import { VideoGenerationRepository } from '../../domain/repositories/video-generation.repository';

// Registra o roteiro (ou a falha) que o provedor entregou por webhook, seja OpenAI ou Claude.
@Injectable()
export class CompleteScriptGenerationUseCase {
  constructor(
    private readonly videoGenerationRepository: VideoGenerationRepository,
  ) {}

  execute (result: ScriptResult) {
    return this.videoGenerationRepository.completeScript(result);
  }
}
