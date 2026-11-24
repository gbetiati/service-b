import { randomUUID } from 'node:crypto';

export type BrandProfile = {
  primaryColor: string | null;
  secondaryColor: string | null;
  tertiaryColor: string | null;
  quaternaryColor: string | null;
  voiceTone: string | null;
  targetAudience: string | null;
  copyGuidelines: string | null;
};

export class Brand {
  constructor(
    readonly id: string,
    readonly companyId: string,
    readonly name: string,
    readonly createdAt: Date,
    readonly updatedAt: Date,
    readonly primaryColor: string | null = null,
    readonly secondaryColor: string | null = null,
    readonly tertiaryColor: string | null = null,
    readonly quaternaryColor: string | null = null,
    readonly voiceTone: string | null = null,
    readonly targetAudience: string | null = null,
    readonly copyGuidelines: string | null = null,
  ) { }

  static create(companyId: string, name: string, profile: Partial<BrandProfile> = {}) {
    const now = new Date();
    const { primaryColor, secondaryColor, tertiaryColor, quaternaryColor, voiceTone, targetAudience, copyGuidelines } = profile;
    return new Brand(
      randomUUID(),
      companyId,
      name,
      now,
      now,
      normalizeColor(primaryColor),
      normalizeColor(secondaryColor),
      normalizeColor(tertiaryColor),
      normalizeColor(quaternaryColor),
      voiceTone ?? null,
      targetAudience ?? null,
      copyGuidelines ?? null
    );
  }
}

function normalizeColor(color: string | null | undefined) {
  return color?.toLowerCase() ?? null;
}
