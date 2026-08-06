import {
  completeIdempotencyOperation,
  createEmptyIdempotencyOperation,
  resolveIdempotencyOperation,
} from './idempotency';

describe('publish idempotency operation', () => {
  let counter: number;
  const createKey = () => `key-${++counter}`;

  beforeEach(() => {
    counter = 0;
  });

  it('reuses the same key while the payload is unchanged', () => {
    const first = resolveIdempotencyOperation(createEmptyIdempotencyOperation(), { version: 4 }, createKey);
    const second = resolveIdempotencyOperation(first.state, { version: 4 }, createKey);

    expect(first.key).toBe('key-1');
    expect(second.key).toBe('key-1');
  });

  it('issues a new key when the payload changes', () => {
    const first = resolveIdempotencyOperation(createEmptyIdempotencyOperation(), { version: 4 }, createKey);
    const second = resolveIdempotencyOperation(first.state, { version: 5 }, createKey);

    expect(second.key).toBe('key-2');
  });

  it('resets after completion so a new operation gets a fresh key', () => {
    const first = resolveIdempotencyOperation(createEmptyIdempotencyOperation(), { version: 4 }, createKey);
    const afterComplete = completeIdempotencyOperation();
    const next = resolveIdempotencyOperation(afterComplete, { version: 4 }, createKey);

    expect(first.key).toBe('key-1');
    expect(next.key).toBe('key-2');
  });
});
