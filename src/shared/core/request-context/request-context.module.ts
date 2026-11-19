import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { RequestContext } from './request-context';
import { RequestContextMiddleware } from './request-context.middleware';

@Global()
@Module({ providers: [RequestContext], exports: [RequestContext] })
export class RequestContextModule implements NestModule {
  configure (consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('{*path}');
  }
}
