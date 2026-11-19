import { Injectable } from '@nestjs/common';
import { AppError } from '@/shared/core/errors/app.error';
import { UserRepository } from '../../domain/repositories/user.repository';
import { PasswordHasher } from '../../domain/providers/password-hasher';
import { SessionTokenProvider } from '../../domain/providers/session-token.provider';
import { LoginDto } from '../dto/login.dto';

@Injectable()
export class LoginUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly sessionTokenProvider: SessionTokenProvider,
  ) {}

  async execute (dto: LoginDto) {
    const user = await this.userRepository.findByEmail(dto.email.toLowerCase());

    if (!await this.passwordHasher.verify(dto.password, user?.passwordHash) || !user) {
      throw new AppError('unauthorized', 'E-mail ou senha inválidos.');
    }

    return { userId: user.id, companyId: user.companyId, accessToken: await this.sessionTokenProvider.sign(user.id, user.companyId) };
  }
}
