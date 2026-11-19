import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import { AppError } from '../errors/app.error';

export type RequestIdentity = { userId: string; companyId: string };

@Injectable()
export class RequestContext {
  private readonly storage = new AsyncLocalStorage<{ identity?: RequestIdentity; companyId?: string }>();

  run<T> (callback: () => T): T {
    return this.storage.run({}, callback);
  }

  runForCompany<T> (companyId: string, callback: () => T): T {
    return this.storage.run({ companyId }, callback);
  }

  setIdentity (identity: RequestIdentity) {
    const store = this.storage.getStore();

    if (!store) throw new Error('Request context missing');

    store.identity = identity;
  }

  get identity () {
    const identity = this.storage.getStore()?.identity;

    if (!identity) throw new AppError('unauthorized', 'Sessão inválida.');

    return identity;
  }

  get userId () {
    return this.identity.userId;
  }

  get companyId () {
    return this.storage.getStore()?.companyId ?? this.identity.companyId;
  }
}
