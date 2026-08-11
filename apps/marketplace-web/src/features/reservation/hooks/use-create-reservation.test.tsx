import { act, renderHook } from '@testing-library/react';
import { getReservationEventSlug, getReservationToken } from '../lib/reservation-session';
import { useCreateReservation } from './use-create-reservation';

const idempotencyKey = '4671a36a-6198-4399-b355-8fb7bc1cfc29';
const continuationToken = ['test', 'reservation', 'continuation'].join('-');
const reservation = {
  reservationId: 'd61805ca-1d0c-42ca-8627-5b5914d12c29', token: continuationToken, status: 'ACTIVE',
  expiresAt: '2026-08-11T12:15:00.000Z', currency: 'BRL', subtotalAmount: 5000, items: [],
};

describe('useCreateReservation', () => {
  beforeEach(() => {
    sessionStorage.clear();
    jest.clearAllMocks();
    Object.defineProperty(globalThis.crypto, 'randomUUID', {
      configurable: true,
      value: jest.fn().mockReturnValue(idempotencyKey),
    });
    global.fetch = jest.fn();
  });

  it('saves the token in session storage after a successful reservation', async () => {
    jest.mocked(fetch).mockResolvedValue({ ok: true, json: async () => reservation } as Response);
    const { result } = renderHook(() => useCreateReservation('summer-fest'));

    await act(async () => {
      await result.current.create([{ ticketTypeId: '9b0bfd6d-a8f4-4088-a6e3-cd82f2cf6048', quantity: 1 }]);
    });

    expect(getReservationToken('d61805ca-1d0c-42ca-8627-5b5914d12c29')).toBe(continuationToken);
    expect(getReservationEventSlug('d61805ca-1d0c-42ca-8627-5b5914d12c29')).toBe('summer-fest');
  });

  it('reuses the same idempotency key when a failed attempt is retried', async () => {
    jest.mocked(fetch)
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce({ ok: true, json: async () => reservation } as Response);
    const items = [{ ticketTypeId: '9b0bfd6d-a8f4-4088-a6e3-cd82f2cf6048', quantity: 1 }];
    const { result } = renderHook(() => useCreateReservation('summer-fest'));

    await act(async () => { await expect(result.current.create(items)).rejects.toThrow('network error'); });
    await act(async () => { await result.current.create(items); });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(jest.mocked(fetch).mock.calls[0]?.[1]).toMatchObject({ headers: { 'Idempotency-Key': idempotencyKey } });
    expect(jest.mocked(fetch).mock.calls[1]?.[1]).toMatchObject({ headers: { 'Idempotency-Key': idempotencyKey } });
  });

  it('reuses the pending attempt key after a remount', async () => {
    jest.mocked(fetch)
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce({ ok: true, json: async () => reservation } as Response);
    const items = [{ ticketTypeId: '9b0bfd6d-a8f4-4088-a6e3-cd82f2cf6048', quantity: 1 }];
    const first = renderHook(() => useCreateReservation('summer-fest'));

    await act(async () => { await expect(first.result.current.create(items)).rejects.toThrow('network error'); });
    first.unmount();

    const second = renderHook(() => useCreateReservation('summer-fest'));
    await act(async () => { await second.result.current.create(items); });

    expect(jest.mocked(fetch).mock.calls[0]?.[1]).toMatchObject({ headers: { 'Idempotency-Key': idempotencyKey } });
    expect(jest.mocked(fetch).mock.calls[1]?.[1]).toMatchObject({ headers: { 'Idempotency-Key': idempotencyKey } });
  });
});
