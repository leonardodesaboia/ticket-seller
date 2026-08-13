import { Reservation } from './reservation.entity';

describe('Reservation', () => {
  const props = {
    id: 'reservation-id',
    organizationId: 'organization-id',
    eventId: 'event-id',
    status: 'ACTIVE' as const,
    expiresAt: new Date('2026-08-11T12:15:00.000Z'),
    currency: 'BRL',
    subtotalAmount: 5000n,
    createdAt: new Date('2026-08-11T12:00:00.000Z'),
    updatedAt: new Date('2026-08-11T12:00:00.000Z'),
  };

  it('exposes its construction properties', () => {
    const reservation = new Reservation(props);

    expect(reservation.props).toEqual(props);
  });

  it('rejects a negative subtotal', () => {
    expect(() => new Reservation({ ...props, subtotalAmount: -1n })).toThrow(
      'Reservation subtotal cannot be negative',
    );
  });
});
