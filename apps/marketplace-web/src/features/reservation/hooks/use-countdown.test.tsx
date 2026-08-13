import { act, renderHook } from '@testing-library/react';
import { formatRemainingTime, useCountdown } from './use-countdown';

describe('useCountdown', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-11T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('counts down from the server expiration and becomes expired at zero', () => {
    const { result } = renderHook(() => useCountdown('2026-08-11T12:01:00.000Z'));

    expect(result.current).toEqual({ remaining: 60, expired: false });

    act(() => jest.advanceTimersByTime(60_000));

    expect(result.current).toEqual({ remaining: 0, expired: true });
  });

  it('does not consider a missing expiry as an expired reservation', () => {
    const { result } = renderHook(() => useCountdown(null));

    expect(result.current).toEqual({ remaining: 0, expired: false });
  });

  it('formats the remaining time for the visual countdown', () => {
    expect(formatRemainingTime(65)).toBe('1:05');
  });
});
