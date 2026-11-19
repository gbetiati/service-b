import { Injectable } from '@nestjs/common';
import { UserRepository } from '../../domain/repositories/user.repository';
import { PasswordHasher } from '../../domain/providers/password-hasher';
import { SessionTokenProvider } from '../../domain/providers/session-token.provider';
import { SignupDto } from '../dto/signup.dto';

@Injectable()
export class SignupUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly sessionTokenProvider: SessionTokenProvider,
  ) {}

  async execute(dto: SignupDto)
  {
    const passwordHash = await this.passwordHasher.hash(dto.password);
    const user = await this.userRepository.createWithCompany(dto.companyName, dto.email.toLowerCase(), passwordHash);
    return { userId: user.id, companyId: user.companyId, accessToken: await this.sessionTokenProvider.sign(user.id, user.companyId) };
  }
}
