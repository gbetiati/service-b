import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../jwt/jwt-auth.guard';
import { TenantGuard } from './tenant.guard';

// Exige um JWT válido e publica userId e companyId no RequestContext.
export const Authenticated = () => UseGuards(JwtAuthGuard, TenantGuard);
