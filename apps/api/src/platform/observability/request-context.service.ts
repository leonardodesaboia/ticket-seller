import { Injectable } from '@nestjs/common';
import { requestContextStorage, type RequestContext } from './request-context';

@Injectable()
export class RequestContextService {
  get(): RequestContext | undefined {
    return requestContextStorage.getStore();
  }

  get requestId(): string | undefined {
    return this.get()?.requestId;
  }

  get userId(): string | undefined {
    return this.get()?.userId;
  }

  get organizationId(): string | undefined {
    return this.get()?.organizationId;
  }

  set(key: keyof RequestContext, value: string): void {
    const store = this.get();
    if (store) {
      store[key] = value;
    }
  }
}
