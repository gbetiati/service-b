import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { requiredEnv } from '@/shared/core/config';
import { SessionTokenProvider } from '../../domain/providers/session-token.provider';

export const jwtClaims = { issuer: 'service-b', audience: 'service-b-api' };

export function jwtSecret () {
  const secret = requiredEnv('JWT_SECRET');

  if (Buffer.byteLength(secret) < 32) throw new Error('JWT_SECRET precisa ter pelo menos 32 bytes.');

  return secret;
}

@Injectable()
export class JwtTokenProvider implements SessionTokenProvider {
  constructor(
    private readonly jwtService: JwtService,
  ) {}

  sign (userId: string, companyId: string) {
    return this.jwtService.signAsync({ sub: userId, companyId }, { ...jwtClaims, expiresIn: '1h', algorithm: 'HS256' });
  }
}
