import { ReservationItem } from './reservation-item.entity';

describe('ReservationItem', () => {
  const props = {
    id: 'item-id',
    ticketTypeId: 'ticket-type-id',
    quantity: 2,
    name: 'General',
    unitPriceAmount: 5000n,
    subtotalAmount: 10000n,
    currency: 'BRL',
  };

  it('accepts a positive integer quantity', () => {
    expect(new ReservationItem(props).props).toEqual(props);
  });

  it.each([0, -1, 1.5])('rejects an invalid quantity of %p', (quantity) => {
    expect(() => new ReservationItem({ ...props, quantity })).toThrow(
      'Reservation item quantity must be a positive integer',
    );
  });
});
