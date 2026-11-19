export class User {
  constructor(
    readonly id: string,
    readonly companyId: string,
    readonly email: string,
    readonly passwordHash: string,
  ) {}
}
