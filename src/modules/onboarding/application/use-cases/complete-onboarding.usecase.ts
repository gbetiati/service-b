import { Injectable, Logger } from '@nestjs/common';
import { UploadBrandLogoUseCase } from '@/modules/brand/application/use-cases/upload-brand-logo.usecase';
import { AppError, requireRecord } from '@/shared/core/errors/app.error';
import { RequestContext } from '@/shared/core/request-context/request-context';
import { OnboardingSession } from '../../domain/entities/onboarding-session.entity';
import { RemoteImageDownloader } from '../../domain/providers/remote-image-downloader';
import { CompletedProfile, OnboardingSessionRepository } from '../../domain/repositories/onboarding-session.repository';
import { CompleteOnboardingDto } from '../dto/complete-onboarding.dto';

// Conclui o onboarding com os dados revisados: cria a marca principal, atualiza a empresa e libera o sistema. O logo
// encontrado na varredura é importado depois, sem bloquear a conclusão se falhar (o usuário pode enviar outro).
@Injectable()
export class CompleteOnboardingUseCase {
  private readonly logger = new Logger(CompleteOnboardingUseCase.name);

  constructor(
    private readonly sessions: OnboardingSessionRepository,
    private readonly requestContext: RequestContext,
    private readonly uploadBrandLogo: UploadBrandLogoUseCase,
    private readonly images: RemoteImageDownloader,
  ) {}

  async execute ({ sessionId, company, brand, useFoundLogo }: CompleteOnboardingDto) {
    const { companyId } = this.requestContext;
    const session = sessionId ? requireRecord(await this.sessions.findById(companyId, sessionId), 'Sessão de onboarding') : null;

    if (session && session.status === 'RESEARCHING') throw new AppError('conflict', 'A análise ainda está em andamento.');

    const empty = (value?: string) => value?.trim() || null;
    const profile: CompletedProfile = {
      company: {
        name: company.name, website: OnboardingSession.normalizeWebsite(company.website), instagramHandle: OnboardingSession.normalizeHandle(company.instagramHandle),
        segment: empty(company.segment), description: empty(company.description), phone: empty(company.phone), serviceArea: empty(company.serviceArea),
      },
      brand,
    };
    const { brandId } = await this.sessions.complete(companyId, session?.id ?? null, profile);
    const logoUrl = useFoundLogo ? session?.findings?.logoUrl : null;
    let logoImported = false;

    if (logoUrl) {
      try {
        await this.uploadBrandLogo.execute(brandId, await this.images.download(logoUrl));
        logoImported = true;
      } catch (error) {
        this.logger.warn(`Logo da varredura não importado. marca=${brandId} motivo=${error instanceof Error ? error.message : 'desconhecido'}`);
      }
    }

    return { brandId, logoImported };
  }
}
