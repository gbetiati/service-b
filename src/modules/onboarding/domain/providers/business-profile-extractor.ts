import type { OnboardingFindings } from '../entities/onboarding-session.entity';
import type { InstagramProfile } from './instagram-profile.provider';
import type { WebsiteSnapshot } from './website-scanner';

export type BusinessSources = { websiteUrl: string | null; instagramHandle: string | null; website: WebsiteSnapshot | null; instagram: InstagramProfile | null };

// Monta o perfil da empresa e da marca principal a partir do que foi lido (IA). O que vem do site e do Instagram é
// dado, nunca instrução.
export abstract class BusinessProfileExtractor {
  abstract extract (sources: BusinessSources): Promise<Omit<OnboardingFindings, 'warnings' | 'logoUrl'> & { logoUrl: string | null }>;
}
