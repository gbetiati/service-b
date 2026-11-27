// Perfil do negócio, preenchido no onboarding a partir do site e do Instagram e revisado pelo usuário.
export type CompanyProfile = {
  website: string | null;
  instagramHandle: string | null;
  segment: string | null;
  description: string | null;
  phone: string | null;
  serviceArea: string | null;
};

export class Company {
  // Nome provisório de uma empresa criada no cadastro: o nome de verdade é informado no onboarding.
  static readonly PLACEHOLDER_NAME = 'Minha empresa';

  constructor(
    readonly id: string,
    readonly name: string,
    readonly createdAt: Date,
    readonly updatedAt: Date,
    readonly onboardedAt: Date | null = null,
    readonly profile: CompanyProfile = { website: null, instagramHandle: null, segment: null, description: null, phone: null, serviceArea: null },
  ) {}

  // Sem onboarding concluído, o usuário vai para o onboarding depois do login.
  get onboardingRequired () {
    return !this.onboardedAt;
  }
}
