import { Injectable, Logger } from '@nestjs/common';
import { AppError } from '@/shared/core/errors/app.error';
import { MAX_RESEARCH_ATTEMPTS, OnboardingFindings } from '../../domain/entities/onboarding-session.entity';
import { BusinessProfileExtractor } from '../../domain/providers/business-profile-extractor';
import { InstagramProfile, InstagramProfileProvider, InstagramUnavailableError } from '../../domain/providers/instagram-profile.provider';
import { WebsiteScanner, WebsiteSnapshot } from '../../domain/providers/website-scanner';
import { OnboardingSessionRepository } from '../../domain/repositories/onboarding-session.repository';

// Tempo de reserva de uma varredura: site, Instagram e IA juntos levam menos de 2 min.
export const ONBOARDING_LEASE_MS = 3 * 60_000;

const HEX = /^#[0-9a-f]{6}$/i;

// Varredura de uma sessão: lê o site e o Instagram (cada um pode falhar sem derrubar o outro), pede à IA o perfil da
// empresa e da marca principal e guarda o resultado para a revisão. Só falha se nada puder ser lido.
@Injectable()
export class RunOnboardingResearchUseCase {
  private readonly logger = new Logger(RunOnboardingResearchUseCase.name);

  constructor(
    private readonly sessions: OnboardingSessionRepository,
    private readonly websiteScanner: WebsiteScanner,
    private readonly instagramProfiles: InstagramProfileProvider,
    private readonly extractor: BusinessProfileExtractor,
  ) {}

  // Processa a próxima sessão pendente. Devolve false quando não havia nenhuma.
  async runNext () {
    const session = await this.sessions.claimNext(ONBOARDING_LEASE_MS);

    if (!session) return false;

    const { id } = session;
    try {
      const warnings: string[] = [];
      let website: WebsiteSnapshot | null = null;
      let instagram: InstagramProfile | null = null;

      if (session.websiteUrl) {
        await this.sessions.setStage(id, 'WEBSITE');
        website = await this.websiteScanner.scan(session.websiteUrl).catch(error => {
          warnings.push(`Não foi possível ler o site: ${reason(error, 'erro ao acessar.')}`);
          return null;
        });
      }

      // Sem @ informado, usa o Instagram linkado no próprio site.
      const handle = session.instagramHandle ?? website?.instagramHandles[0] ?? null;

      if (handle) {
        await this.sessions.setStage(id, 'INSTAGRAM');
        let unavailable = false;
        instagram = await this.instagramProfiles.find(handle).catch(error => {
          unavailable = true;
          warnings.push(error instanceof InstagramUnavailableError ? error.message : `Não foi possível ler o Instagram @${handle}.`);
          return null;
        });

        if (!instagram && !unavailable) warnings.push(`O perfil @${handle} não foi encontrado ou não é uma conta profissional.`);
      }

      if (!website && !instagram) {
        return this.sessions.markFailed(id, ['Não conseguimos ler o site nem o Instagram informados.', ...warnings].join(' '));
      }

      await this.sessions.setStage(id, 'ANALYSIS');
      const extracted = await this.extractor.extract({ websiteUrl: website?.url ?? session.websiteUrl, instagramHandle: handle, website, instagram });
      await this.sessions.markReady(id, sanitize(extracted, { website, instagram, websiteUrl: website?.url ?? session.websiteUrl, handle: instagram?.username ?? handle, warnings }));
      this.logger.log(`Varredura do onboarding concluída. sessão=${id} site=${!!website} instagram=${!!instagram}`);
    } catch (error) {
      const message = reason(error, 'Não foi possível analisar o negócio.');
      this.logger.warn(`Varredura do onboarding falhou. sessão=${id} tentativa=${session.attempts} motivo=${message}`);

      if (session.attempts < MAX_RESEARCH_ATTEMPTS && !(error instanceof AppError && error.kind === 'invalid')) return this.sessions.release(id);

      await this.sessions.markFailed(id, message);
    }
  }
}

function reason (error: unknown, fallback: string) {
  return error instanceof AppError ? error.message : fallback;
}

// Garante o que não pode depender da IA: o site e o @ informados prevalecem, cores só em hexadecimal e o logo só
// entre os candidatos realmente encontrados (nunca uma URL inventada).
export function sanitize (
  extracted: Omit<OnboardingFindings, 'warnings'>,
  { website, instagram, websiteUrl, handle, warnings }: { website: WebsiteSnapshot | null; instagram: InstagramProfile | null; websiteUrl: string | null; handle: string | null; warnings: string[] },
): OnboardingFindings {
  const candidates = [...(website?.logoCandidates ?? []), ...(instagram?.profilePictureUrl ? [instagram.profilePictureUrl] : [])];
  const color = (value: string | null) => (value && HEX.test(value) ? value.toLowerCase() : null);
  const { brand } = extracted;
  return {
    ...extracted,
    // Sem nome da empresa, usa o nome do site, o do perfil do Instagram ou o da marca principal.
    company: {
      ...extracted.company, name: extracted.company.name ?? website?.siteName ?? instagram?.name ?? brand.name,
      website: websiteUrl ?? extracted.company.website, instagramHandle: handle ?? extracted.company.instagramHandle,
    },
    brand: { ...brand, primaryColor: color(brand.primaryColor), secondaryColor: color(brand.secondaryColor), tertiaryColor: color(brand.tertiaryColor), quaternaryColor: color(brand.quaternaryColor) },
    logoUrl: extracted.logoUrl && candidates.includes(extracted.logoUrl) ? extracted.logoUrl : candidates[0] ?? null,
    warnings,
  };
}
