import { Injectable } from '@nestjs/common';
import { SocialPlatformProvider } from '@/modules/social-account/domain/providers/social-platform.provider';
import { TokenCipherProvider } from '@/modules/social-account/domain/providers/token-cipher.provider';
import { StorageProvider } from '@/shared/libs/storage/storage.provider';
import { EncryptedToken } from '@/modules/social-account/domain/entities/social-credential.entity';
import { PUBLICATION_GRACE_MS } from '../../domain/entities/publication-timing';
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

  async execute(job: PublicationWork, videoKey: string, credential: EncryptedToken)
  {
    const date = job.schedule.date.getTime();
    const expired = Date.now() >= date + PUBLICATION_GRACE_MS;
    try {
      const token = this.tokenCipherProvider.decrypt(credential, job.companyId);
      
      if (!job.containerId && !expired) {
        const url = await this.storageProvider.url(videoKey, 3600);
        const container = await this.socialPlatformProvider.createVideo(job.accountExternalId, token, url, job.caption ?? '');
        return await this.publicationRepository.defer(job, container, this.nextCheck(date));
      }

      if (job.containerId) {
        const state = await this.socialPlatformProvider.containerStatus(job.containerId, token);
        if (state === 'published') return await this.publicationRepository.succeed(job);
        if (state === 'failed') return await this.publicationRepository.fail(job, 'O Instagram rejeitou o vídeo.');
        if (!expired && state === 'ready') {
          if (Date.now() < date) return this.publicationRepository.defer(job, undefined, job.schedule.date);
          const mediaId = await this.socialPlatformProvider.publish(job.accountExternalId, job.containerId, token);
          return await this.publicationRepository.succeed(job, mediaId);
        }
      }
    } catch {
      if (expired) return this.publicationRepository.fail(job, 'O prazo de publicação expirou sem confirmação do Instagram.');
    }
    
    if (expired) return this.publicationRepository.fail(job, 'O prazo de publicação expirou.');
    
    await this.publicationRepository.defer(job, undefined, this.nextCheck(date));
  }
  private nextCheck(date: number)
  {
    const now = Date.now();
    return new Date(now < date ? Math.min(now + 60_000, date) : now + 60_000);
  }
}
