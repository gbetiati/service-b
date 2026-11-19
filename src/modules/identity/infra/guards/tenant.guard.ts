import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { RequestContext, RequestIdentity } from '@/shared/core/request-context/request-context';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly requestContext: RequestContext,
  ) {}
  canActivate(execution: ExecutionContext)
  {
    const user = execution.switchToHttp().getRequest<{ user?: RequestIdentity }>().user;
    if (!user?.userId || !user.companyId) throw new UnauthorizedException();
    this.requestContext.setIdentity(user);
    return true;
  }
}
