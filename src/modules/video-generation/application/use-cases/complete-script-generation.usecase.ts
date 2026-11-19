import { Injectable } from '@nestjs/common';
import { ScriptProvider } from '@/modules/content/domain/providers/script.provider';
import { VideoGenerationRepository } from '../../domain/repositories/video-generation.repository';

@Injectable()
export class CompleteScriptGenerationUseCase {
  constructor(
    private readonly scriptProvider: ScriptProvider,
    private readonly videoGenerationRepository: VideoGenerationRepository,
  ) {}

  async execute (responseId: string) {
    const notification = await this.scriptProvider.readResult(responseId);
    return notification && this.videoGenerationRepository.completeScript(notification);
  }
}
