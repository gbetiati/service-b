import { Injectable } from '@nestjs/common';
import { ScriptProvider } from '@/modules/content/domain/providers/script.provider';
import { ContentRepository } from '@/modules/content/domain/repositories/content.repository';
import { AppError, requireRecord } from '@/shared/core/errors/app.error';
import { RequestContext } from '@/shared/core/request-context/request-context';
import { StorageProvider } from '@/shared/libs/storage/storage.provider';
import { VideoGeneration } from '../../domain/entities/video-generation.entity';
import { VideoProvider } from '../../domain/providers/video.provider';
import { VideoGenerationRepository } from '../../domain/repositories/video-generation.repository';

type GenerationCommand = { companyId: string; contentId: string };

@Injectable()
export class GenerateVideoUseCase {
  constructor(
    private readonly contentRepository: ContentRepository,
    private readonly videoGenerationRepository: VideoGenerationRepository,
    private readonly scriptProvider: ScriptProvider,
    private readonly videoProvider: VideoProvider,
    private readonly storageProvider: StorageProvider,
    private readonly requestContext: RequestContext,
  ) { }

  execute (contentId: string) {
    return this.generate(contentId, 'manual');
  }

  requestScript ({ companyId, contentId }: GenerationCommand) {
    return this.requestContext.runForCompany(companyId, () => this.generate(contentId, 'script'));
  }

  requestVideo ({ companyId, contentId }: GenerationCommand) {
    return this.requestContext.runForCompany(companyId, () => this.generate(contentId, 'video'));
  }

  private async generate (contentId: string, mode: 'manual' | 'script' | 'video') {
    const content = requireRecord(await this.contentRepository.findById(contentId), 'Conteúdo');

    if (mode === 'video' && (content.scriptStatus !== 'READY' || !content.fields.aiScript.trim())) {
      throw new AppError('conflict', 'O roteiro ainda não está pronto para solicitar o vídeo.');
    }

    const existing = await this.videoGenerationRepository.findCurrent(contentId, content.revision);

    if (existing && mode === 'script') return this.submitScript(existing);

    if (existing && mode === 'video') return this.submit(existing);

    if (existing && existing.status !== 'FAILED') return this.advance(existing);

    const { assets, aiScript } = content.fields;

    if (!assets.length) throw new AppError('invalid', 'Associe ao menos uma foto real do produto ao conteúdo.');

    const references = await this.contentRepository.findReferences(content);
    const brief = content.buildScriptBrief(references);

    const imageKeys = assets.map(asset =>
      requireRecord(references.images.find(image => image.id === asset.mediaAssetId), 'Imagem').storageKey);

    const needsScriptWebhook = mode === 'script';

    const script = needsScriptWebhook ? '' : (aiScript.trim() && aiScript) || await this.scriptProvider.generate(brief);

    const generation = await this.videoGenerationRepository.create(
      contentId, content.revision, { script, imageKeys, brief }, mode === 'manual', needsScriptWebhook ? 'PENDING_SCRIPT' : 'PENDING',
    );

    return needsScriptWebhook ? this.submitScript(generation) : this.submit(generation);
  }

  private advance (generation: VideoGeneration) {
    return generation.status === 'PENDING_SCRIPT' ? this.submitScript(generation) : this.submit(generation);
  }

  private async submitScript (generation: VideoGeneration) {
    if (generation.status !== 'PENDING_SCRIPT') return this.result(generation);

    const job = await this.videoGenerationRepository.claimScriptSubmission(generation);

    if (!job) return this.readSubmissionResult(generation);

    try {
      await this.scriptProvider.request(job.input.brief, job.scriptSubmissionId);
    } catch {
      await this.videoGenerationRepository.fail(job, 'Falha ao solicitar roteiro.', 'script');
      return this.readSubmissionResult(job);
    }

    await this.videoGenerationRepository.scriptSubmitted(job);
    return this.readSubmissionResult(generation);
  }

  private async submit (generation: VideoGeneration) {
    if (generation.status !== 'PENDING') return this.result(generation);

    const job = await this.videoGenerationRepository.claimSubmission(generation);

    if (job) {
      let providerId: string;
      try {
        const imageUrls = await Promise.all(job.input.imageKeys.map(key => this.storageProvider.url(key, 7200)));
        providerId = await this.videoProvider.render({ submissionId: job.submissionId, script: job.input.script, imageUrls });
      } catch {
        await this.videoGenerationRepository.fail(job, 'Falha ao solicitar o render. Confirme a configuração e o template.');
        return this.readSubmissionResult(job);
      }
      await this.videoGenerationRepository.submitted(job, providerId);
    }

    return this.readSubmissionResult(generation);
  }

  private async readSubmissionResult (generation: VideoGeneration) {
    const current = await this.videoGenerationRepository.findCurrent(generation.contentId, generation.revision);
    return this.result(requireRecord(current, 'Geração'));
  }

  private result ({ id, contentId, revision, status }: VideoGeneration) {
    return { id, contentId, revision, status };
  }
}
