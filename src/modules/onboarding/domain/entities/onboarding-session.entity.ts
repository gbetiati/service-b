import { AppError } from '@/shared/core/errors/app.error';

export type OnboardingStatus = 'RESEARCHING' | 'READY' | 'FAILED' | 'COMPLETED';

// Etapa da varredura em andamento, mostrada na tela de progresso.
export type OnboardingStage = 'WEBSITE' | 'INSTAGRAM' | 'ANALYSIS';

// De onde veio cada dado encontrado: lido no site, lido no Instagram ou deduzido pela IA a partir dos dois.
export type FindingSource = 'website' | 'instagram' | 'inferred';

export type CompanyDraft = {
  name: string | null;
  segment: string | null;
  description: string | null;
  serviceArea: string | null;
  phone: string | null;
  website: string | null;
  instagramHandle: string | null;
};

export type BrandDraft = {
  name: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  tertiaryColor: string | null;
  quaternaryColor: string | null;
  voiceTone: string | null;
  targetAudience: string | null;
  copyGuidelines: string | null;
};

// Resultado da varredura, revisado pelo usuário antes de concluir. `sources` diz a origem de cada campo
// ("company.name", "brand.voiceTone"...); `warnings` explica o que não foi possível ler (ex.: Instagram indisponível).
export type OnboardingFindings = {
  company: CompanyDraft;
  brand: BrandDraft;
  products: { name: string; description: string | null }[];
  otherBrands: string[];
  logoUrl: string | null;
  sources: Record<string, FindingSource>;
  warnings: string[];
};

export const MAX_RESEARCH_ATTEMPTS = 2;

export class OnboardingSession {
  constructor(
    readonly id: string,
    readonly companyId: string,
    readonly userId: string,
    readonly websiteUrl: string | null,
    readonly instagramHandle: string | null,
    readonly status: OnboardingStatus,
    readonly stage: OnboardingStage | null,
    readonly findings: OnboardingFindings | null,
    readonly error: string | null,
    readonly createdAt: Date,
    readonly updatedAt: Date,
  ) {}

  // @ do Instagram como o usuário digitar (com ou sem @, ou o link do perfil), validado no formato do Instagram.
  static normalizeHandle (raw?: string | null) {
    const value = raw?.trim();

    if (!value) return null;

    const handle = value.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/[/?#].*$/, '').toLowerCase();

    if (!/^[a-z0-9._]{1,30}$/.test(handle) || /^\.|\.$|\.\./.test(handle)) throw new AppError('invalid', 'Informe um @ do Instagram válido, como @suaempresa.');

    return handle;
  }

  // Site como o usuário digitar: sem protocolo vira https. A checagem de endereço público fica na busca.
  static normalizeWebsite (raw?: string | null) {
    const value = raw?.trim();

    if (!value) return null;

    const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;
    let url: URL;
    try {
      url = new URL(withProtocol);
    } catch {
      throw new AppError('invalid', 'Informe um site válido, como www.suaempresa.com.br.');
    }

    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.')) throw new AppError('invalid', 'Informe um site válido, como www.suaempresa.com.br.');

    return url.toString();
  }

  static validateInput (websiteUrl: string | null, instagramHandle: string | null) {
    if (!websiteUrl && !instagramHandle) throw new AppError('invalid', 'Informe o site ou o @ do Instagram da empresa.');
  }

  get finished () {
    return this.status !== 'RESEARCHING';
  }
}
