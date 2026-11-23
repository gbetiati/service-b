import { Injectable } from '@nestjs/common';
import { ContentPreparationRepository } from '@/modules/content/domain/repositories/content-preparation.repository';
import { SocialPlatformProvider } from '@/modules/social-account/domain/providers/social-platform.provider';
import { TokenCipherProvider } from '@/modules/social-account/domain/providers/token-cipher.provider';
import { StorageProvider } from '@/shared/libs/storage/storage.provider';
import { EncryptedToken } from '@/modules/social-account/domain/entities/social-credential.entity';
import { PublicationPolicy } from '../../domain/entities/publication.policy';
import { PublicationWork } from '../../domain/entities/publication.entity';
import { PublicationRepository } from '../../domain/repositories/publication.repository';

@Injectable()
export class PublishScheduledContentUseCase {
  constructor(
    private readonly publicationRepository: PublicationRepository,
    private readonly socialPlatformProvider: SocialPlatformProvider,
    private readonly tokenCipherProvider: TokenCipherProvider,
    private readonly storageProvider: StorageProvider,
    private readonly contentPreparationRepository: ContentPreparationRepository,
  ) { }

  async processScheduled (id: string) {
    const job = await this.publicationRepository.reserveForProcessing(id);
    if (!job) return;

    const { companyId, schedule, credential, accountActive } = job;
    if (!credential || !PublicationPolicy.canPublishWithCredential(accountActive, credential, schedule.date, Date.now())) {
      return this.publicationRepository.markFailed(job, 'A conta precisa ter uma credencial ativa para publicar.');
    }
    if (!PublicationPolicy.isWithinGraceWindow(schedule.date, Date.now())) {
      return this.publicationRepository.markFailed(job, 'O prazo da publicação expirou.');
    }
    const state = await this.contentPreparationRepository.read({ companyId, contentId: schedule.contentId }, schedule.videoId);
    if ([state.scriptStatus, state.videoStatus, state.transcriptionStatus, state.subtitleStatus].includes('FAILED')) {
      return this.publicationRepository.markFailed(job, 'Falha na preparação do conteúdo.');
    }
    if (!state.video || !PublicationPolicy.isApprovedVideo(state.status, state.revision, state.video.reviewStatus, state.video.revision)) {
      return this.publicationRepository.markFailed(job, 'Use um vídeo aprovado da revisão atual do conteúdo.');
    }
    if (!schedule.videoId) await this.publicationRepository.attachApprovedVideo(job, state.video.id);

    // O envio ao Instagram permanece desativado.
    return this.publicationRepository.releaseProcessing(job);
  }

  async execute (job: PublicationWork, videoKey: string, credential: EncryptedToken) {
    const date = job.schedule.date;

    if (Date.now() < date.getTime()) return this.publicationRepository.releaseProcessing(job);

    try {
      const token = this.tokenCipherProvider.decrypt(credential, job.companyId);

      if (job.containerId) {
        const state = await this.socialPlatformProvider.containerStatus(job.containerId, token);

        if (state === 'published') return this.publicationRepository.markPublished(job);

        if (state === 'failed') return this.publicationRepository.markFailed(job, 'O Instagram rejeitou o vídeo.');

        if (!PublicationPolicy.isWithinGraceWindow(date, Date.now())) {
          return this.publicationRepository.markFailed(job, 'O prazo de publicação expirou.');
        }

        if (state === 'ready') {
          const mediaId = await this.socialPlatformProvider.publish(job.accountExternalId, job.containerId, token);
          return this.publicationRepository.markPublished(job, mediaId);
        }

        return this.publicationRepository.releaseProcessing(job);
      }

      if (!PublicationPolicy.isWithinGraceWindow(date, Date.now())) {
        return this.publicationRepository.markFailed(job, 'O prazo de publicação expirou.');
      }

      const url = await this.storageProvider.url(videoKey, 3600);
      const container = await this.socialPlatformProvider.createVideo(job.accountExternalId, token, url, job.caption ?? '');
      return this.publicationRepository.releaseProcessing(job, container);
    } catch {
      return this.publicationRepository.markFailed(job, 'Falha na comunicação com o Instagram durante a publicação.');
    }
  }
}
