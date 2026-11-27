import type { OnboardingFindings, OnboardingSession, OnboardingStage } from '../entities/onboarding-session.entity';

export type CompletedProfile = {
  company: { name: string; website: string | null; instagramHandle: string | null; segment: string | null; description: string | null; phone: string | null; serviceArea: string | null };
  brand: {
    name: string; primaryColor?: string; secondaryColor?: string; tertiaryColor?: string; quaternaryColor?: string;
    voiceTone?: string; targetAudience?: string; copyGuidelines?: string;
  };
};

export abstract class OnboardingSessionRepository {
  // Cria a sessão; recusa se já houver uma varredura em andamento na empresa.
  abstract create (input: { companyId: string; userId: string; websiteUrl: string | null; instagramHandle: string | null }): Promise<OnboardingSession>;

  abstract findLatest (companyId: string): Promise<OnboardingSession | null>;

  abstract findById (companyId: string, id: string): Promise<OnboardingSession | null>;

  // Reserva a próxima varredura pendente (lease vencido) e conta a tentativa.
  abstract claimNext (leaseMs: number): Promise<(OnboardingSession & { attempts: number }) | null>;

  abstract setStage (id: string, stage: OnboardingStage): Promise<void>;

  abstract markReady (id: string, findings: OnboardingFindings): Promise<void>;

  abstract markFailed (id: string, error: string): Promise<void>;

  // Libera a reserva para outra tentativa (falha temporária).
  abstract release (id: string): Promise<void>;

  // Conclui numa transação: cria a marca, atualiza a empresa (nome, perfil e onboardedAt) e fecha a sessão.
  // Devolve o id da marca criada. Recusa se a empresa já concluiu o onboarding.
  abstract complete (companyId: string, sessionId: string | null, profile: CompletedProfile): Promise<{ brandId: string }>;
}
