import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { GetCompanyUseCase } from './application/use-cases/get-company.usecase';
import { LoginUseCase } from './application/use-cases/login.usecase';
import { SignupUseCase } from './application/use-cases/signup.usecase';
import { PasswordHasher } from './domain/providers/password-hasher';
import { SessionTokenProvider } from './domain/providers/session-token.provider';
import { CompanyRepository } from './domain/repositories/company.repository';
import { UserRepository } from './domain/repositories/user.repository';
import { AuthController } from './infra/controllers/auth.controller';
import { CompanyController } from './infra/controllers/company.controller';
import { ScryptHasherService } from './infra/crypto/scrypt-hasher.service';
import { JwtStrategy } from './infra/jwt/jwt.strategy';
import { JwtTokenProvider, jwtSecret } from './infra/jwt/jwt-token.provider';
import { PrismaCompanyRepository } from './infra/prisma/company.prisma-repository';
import { PrismaUserRepository } from './infra/prisma/user.prisma-repository';

@Module({
  imports: [PassportModule, JwtModule.registerAsync({ useFactory: () => ({ secret: jwtSecret() }) })],
  controllers: [AuthController, CompanyController],
  providers: [
    JwtStrategy, GetCompanyUseCase, LoginUseCase, SignupUseCase,
    { provide: CompanyRepository, useClass: PrismaCompanyRepository },
    { provide: UserRepository, useClass: PrismaUserRepository },
    { provide: PasswordHasher, useClass: ScryptHasherService },
    { provide: SessionTokenProvider, useClass: JwtTokenProvider },
  ],
})
export class IdentityModule {}
