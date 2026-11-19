export abstract class SessionTokenProvider {
  abstract sign (userId: string, companyId: string): Promise<string>;
}
