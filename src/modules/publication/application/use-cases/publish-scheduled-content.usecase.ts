import { Injectable } from '@nestjs/common';
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
  ) { }

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
