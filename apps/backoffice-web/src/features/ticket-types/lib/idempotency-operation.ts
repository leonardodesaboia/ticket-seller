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
