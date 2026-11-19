import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { RequestContext } from './request-context';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(
    private readonly requestContext: RequestContext,
  ) {}

  use (_req: Request, _res: Response, next: NextFunction) {
    this.requestContext.run(next);
  }
}
