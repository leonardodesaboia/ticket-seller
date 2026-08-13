import { act, renderHook } from '@testing-library/react';
import { usePaymentPolling } from './usePaymentPolling';

const orderId = '9b0bfd6d-a8f4-4088-a6e3-cd82f2cf6048';
const token = 'reservation-token';

function makeAttempt(status: string) {
  return {
    paymentAttemptId: 'attempt-1',
    orderId,
    provider: 'FAKE',
    status,
    paymentMethod: 'FAKE_PIX',
    amount: 5000,
    currency: 'BRL',
    expiresAt: '2027-01-01T00:00:00.000Z',
    checkoutData: null,
  };
}

function response(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

describe('usePaymentPolling', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    global.fetch = jest.fn();
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('calls onUpdate with the latest attempt after each interval', async () => {
    const attempt = makeAttempt('PENDING');
    jest.mocked(fetch).mockResolvedValue(response(attempt));
    const onUpdate = jest.fn();
    const onTimeout = jest.fn();

    renderHook(() => usePaymentPolling({ orderId, token, onUpdate, onTimeout }));

    await act(async () => { jest.advanceTimersByTime(3_000); });

    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: 'PENDING' }));
  });

  it('stops polling on unmount', async () => {
    const attempt = makeAttempt('PENDING');
    jest.mocked(fetch).mockResolvedValue(response(attempt));
    const onUpdate = jest.fn();
    const onTimeout = jest.fn();

    const { unmount } = renderHook(() => usePaymentPolling({ orderId, token, onUpdate, onTimeout }));

    await act(async () => { jest.advanceTimersByTime(3_000); });
    const callCountAfterFirst = jest.mocked(fetch).mock.calls.length;

    unmount();

    await act(async () => { jest.advanceTimersByTime(9_000); });

    expect(jest.mocked(fetch).mock.calls.length).toBe(callCountAfterFirst);
  });

  it('stops polling on a terminal status (APPROVED)', async () => {
    jest.mocked(fetch)
      .mockResolvedValueOnce(response(makeAttempt('PENDING')))
      .mockResolvedValueOnce(response(makeAttempt('APPROVED')));
    const onUpdate = jest.fn();
    const onTimeout = jest.fn();

    renderHook(() => usePaymentPolling({ orderId, token, onUpdate, onTimeout }));

    await act(async () => { jest.advanceTimersByTime(3_000); });
    await act(async () => { jest.advanceTimersByTime(3_000); });

    const callCount = jest.mocked(fetch).mock.calls.length;

    await act(async () => { jest.advanceTimersByTime(9_000); });

    expect(jest.mocked(fetch).mock.calls.length).toBe(callCount);
    expect(onUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'APPROVED' }));
  });

  it('stops polling on terminal status DECLINED', async () => {
    jest.mocked(fetch).mockResolvedValue(response(makeAttempt('DECLINED')));
    const onUpdate = jest.fn();
    const onTimeout = jest.fn();

    renderHook(() => usePaymentPolling({ orderId, token, onUpdate, onTimeout }));

    await act(async () => { jest.advanceTimersByTime(3_000); });

    const countAfterDeclined = jest.mocked(fetch).mock.calls.length;
    await act(async () => { jest.advanceTimersByTime(9_000); });

    expect(jest.mocked(fetch).mock.calls.length).toBe(countAfterDeclined);
  });

  it('calls onTimeout after 5 minutes without a terminal status', async () => {
    jest.mocked(fetch).mockResolvedValue(response(makeAttempt('PENDING')));
    const onUpdate = jest.fn();
    const onTimeout = jest.fn();

    renderHook(() => usePaymentPolling({ orderId, token, onUpdate, onTimeout }));

    await act(async () => { jest.advanceTimersByTime(300_000); });

    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('pauses polling when visibilityState is hidden', async () => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });

    jest.mocked(fetch).mockResolvedValue(response(makeAttempt('PENDING')));
    const onUpdate = jest.fn();
    const onTimeout = jest.fn();

    renderHook(() => usePaymentPolling({ orderId, token, onUpdate, onTimeout }));

    await act(async () => { jest.advanceTimersByTime(15_000); });

    // fetch should not have been called while hidden
    expect(fetch).not.toHaveBeenCalled();
  });
});
