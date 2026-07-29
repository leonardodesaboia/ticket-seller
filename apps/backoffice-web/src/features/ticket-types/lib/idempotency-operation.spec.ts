import {
  completeIdempotencyOperation,
  createEmptyIdempotencyOperation,
  resolveIdempotencyOperation,
} from './idempotency-operation';

const payload = {
  name: 'Inteira',
  description: null,
  priceAmount: 5000,
  capacity: 100,
};

describe('ticket type idempotency operation', () => {
  it('reuses the key for the same logical payload after an unknown failure', () => {
    const first = resolveIdempotencyOperation(
      createEmptyIdempotencyOperation(),
      payload,
      () => 'key-1',
    );
    const retry = resolveIdempotencyOperation(first.state, payload, () => 'key-2');

    expect(retry.key).toBe('key-1');
    expect(retry.state).toEqual(first.state);
  });

  it('creates a new key when the payload changes', () => {
    const first = resolveIdempotencyOperation(
      createEmptyIdempotencyOperation(),
      payload,
      () => 'key-1',
    );
    const changed = resolveIdempotencyOperation(
      first.state,
      { ...payload, capacity: 200 },
      () => 'key-2',
    );

    expect(changed.key).toBe('key-2');
  });

  it('creates a new key after the previous operation succeeds', () => {
    const first = resolveIdempotencyOperation(
      createEmptyIdempotencyOperation(),
      payload,
      () => 'key-1',
    );
    const next = resolveIdempotencyOperation(
      completeIdempotencyOperation(),
      payload,
      () => 'key-2',
    );

    expect(first.key).toBe('key-1');
    expect(next.key).toBe('key-2');
  });
});
