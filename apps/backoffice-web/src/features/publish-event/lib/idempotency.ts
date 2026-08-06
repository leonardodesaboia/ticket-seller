export interface IdempotencyOperationState {
  readonly key: string | null;
  readonly payloadFingerprint: string | null;
}

export function createEmptyIdempotencyOperation(): IdempotencyOperationState {
  return { key: null, payloadFingerprint: null };
}

function fingerprintPayload(payload: Readonly<Record<string, unknown>>): string {
  return JSON.stringify(payload);
}

/**
 * Returns a stable idempotency key for a given payload: the same key is reused
 * while the payload is unchanged, and a new key is issued once the payload
 * differs (so a corrected version starts a fresh operation).
 */
export function resolveIdempotencyOperation(
  state: IdempotencyOperationState,
  payload: Readonly<Record<string, unknown>>,
  createKey: () => string,
): { readonly key: string; readonly state: IdempotencyOperationState } {
  const payloadFingerprint = fingerprintPayload(payload);
  if (state.key && state.payloadFingerprint === payloadFingerprint) {
    return { key: state.key, state };
  }

  const key = createKey();
  return { key, state: { key, payloadFingerprint } };
}

export function completeIdempotencyOperation(): IdempotencyOperationState {
  return createEmptyIdempotencyOperation();
}
