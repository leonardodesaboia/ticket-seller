import '@testing-library/jest-dom';

// jsdom <=20 does not implement crypto.randomUUID; polyfill for tests
if (!('randomUUID' in globalThis.crypto)) {
  let seq = 0;
  Object.defineProperty(globalThis.crypto, 'randomUUID', {
    value: () =>
      `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}` as ReturnType<
        typeof crypto.randomUUID
      >,
    configurable: true,
    writable: true,
  });
}
