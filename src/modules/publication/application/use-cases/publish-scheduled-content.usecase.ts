import { Injectable } from '@nestjs/common';
import { SocialPlatformProvider } from '@/modules/social-account/domain/providers/social-platform.provider';
import { TokenCipherProvider } from '@/modules/social-account/domain/providers/token-cipher.provider';
import { StorageProvider } from '@/shared/libs/storage/storage.provider';
import { PublicationRepository } from '../../domain/repositories/publication.repository';

@Injectable()
export class PublishScheduledContentUseCase {
  constructor(
    private readonly publicationRepository: PublicationRepository,
    private readonly socialPlatformProvider: SocialPlatformProvider,
    private readonly tokenCipherProvider: TokenCipherProvider,
    private readonly storageProvider: StorageProvider,
  ) { }

  async execute(id: string)
  {
    const job = await this.publicationRepository.claim(id);
    if (!job) return;
    if (!job.approved || !job.accountActive || !job.credential?.expiresAt || job.credential.expiresAt.getTime() <= Date.now()) {
      return this.publicationRepository.fail(job, 'O vídeo precisa estar aprovado e a conta precisa ter uma credencial ativa.');
    }
    // Once created, the same Instagram container is reused even after a lost response.
    const expired = Date.now() - job.schedule.date.getTime() > 30 * 60_000;
    try {
      const token = this.tokenCipherProvider.decrypt(job.credential, job.companyId);
      
      if (!job.containerId && !expired) {
        const url = await this.storageProvider.url(job.videoKey, 3600);
        const container = await this.socialPlatformProvider.createVideo(job.accountExternalId, token, url, job.caption ?? '');
        return await this.publicationRepository.defer(job, container);
      }

      if (job.containerId) {
        const state = await this.socialPlatformProvider.containerStatus(job.containerId, token);
        if (state === 'published') return await this.publicationRepository.succeed(job);
        if (state === 'failed') return await this.publicationRepository.fail(job, 'O Instagram rejeitou o vídeo.');
        if (!expired && state === 'ready') {
          const mediaId = await this.socialPlatformProvider.publish(job.accountExternalId, job.containerId, token);
          return await this.publicationRepository.succeed(job, mediaId);
        }
      }
    } catch {
      if (expired) return this.publicationRepository.fail(job, 'O prazo de publicação expirou sem confirmação do Instagram.');
    }
    
    if (expired) return this.publicationRepository.fail(job, 'O prazo de publicação expirou.');
    
    await this.publicationRepository.defer(job);
  }
}
