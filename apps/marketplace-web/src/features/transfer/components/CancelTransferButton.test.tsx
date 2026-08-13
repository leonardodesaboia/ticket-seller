import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { CancelTransferButton } from './CancelTransferButton';

const orderId = 'order-uuid';
const ticketId = 'ticket-1';
const token = 'reservation-token';

function response(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

describe('CancelTransferButton', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('disables the button while loading', async () => {
    let resolveRequest: (value: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      resolveRequest = resolve;
    });
    jest.mocked(fetch).mockReturnValueOnce(pending);

    const onCancelled = jest.fn();
    render(
      <CancelTransferButton
        orderId={orderId}
        ticketId={ticketId}
        token={token}
        onCancelled={onCancelled}
      />,
    );

    const button = screen.getByRole('button', { name: 'Cancelar transferência' });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByRole('button')).toBeDisabled();
    });

    // Resolve the pending request inside act to avoid state-update warnings
    await act(async () => {
      resolveRequest!(response(null, true, 204));
    });
  });

  it('calls onCancelled after successful cancellation', async () => {
    jest.mocked(fetch).mockResolvedValueOnce(response(null, true, 204));

    const onCancelled = jest.fn();
    render(
      <CancelTransferButton
        orderId={orderId}
        ticketId={ticketId}
        token={token}
        onCancelled={onCancelled}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar transferência' }));

    await waitFor(() => {
      expect(onCancelled).toHaveBeenCalledTimes(1);
    });
  });
});
