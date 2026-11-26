import { Injectable } from '@nestjs/common';
import { AppError } from '@/shared/core/errors/app.error';
import { User } from '../../domain/entities/user.entity';
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
    const user = await this.userRepository.findByEmail(User.normalizeEmail(dto.email));

    // A senha é verificada mesmo sem usuário para não revelar, pelo tempo de resposta, quais e-mails existem.
    if (!await this.passwordHasher.verify(dto.password, user?.passwordHash) || !user) {
      throw new AppError('unauthorized', 'E-mail ou senha inválidos.');
    }

    return { userId: user.id, companyId: user.companyId, email: user.email, accessToken: await this.sessionTokenProvider.sign(user.id, user.companyId) };
  }
}
