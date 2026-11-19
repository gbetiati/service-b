import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserRepository } from '../../domain/repositories/user.repository';
import { jwtClaims, jwtSecret } from './jwt-token.provider';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly userRepository: UserRepository,
  ) {
    super({ jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), secretOrKey: jwtSecret(), ...jwtClaims, algorithms: ['HS256'] });
  }

  async validate (claims: { sub?: string; companyId?: string }) {
    if (typeof claims.sub !== 'string' || typeof claims.companyId !== 'string' || !await this.userRepository.exists(claims.sub, claims.companyId)) {
      throw new UnauthorizedException();
    }

    return { userId: claims.sub, companyId: claims.companyId };
  }
}
