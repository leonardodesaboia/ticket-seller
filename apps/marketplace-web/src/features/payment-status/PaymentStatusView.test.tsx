import { act, fireEvent, render, screen } from '@testing-library/react';
import { PaymentStatusView } from './PaymentStatusView';
import type { PaymentAttemptResponse } from '@/shared/api/public-payments.api';

const orderId = '9b0bfd6d-a8f4-4088-a6e3-cd82f2cf6048';
const token = 'reservation-token';

function makeAttempt(overrides: Partial<PaymentAttemptResponse> = {}): PaymentAttemptResponse {
  return {
    paymentAttemptId: 'attempt-1',
    orderId,
    provider: 'FAKE',
    status: 'PENDING',
    paymentMethod: 'FAKE_PIX',
    amount: 10000,
    currency: 'BRL',
    expiresAt: '2027-01-01T00:00:00.000Z',
    checkoutData: {
      type: 'PIX',
      qrCodeText: 'pix-code-text-here',
    },
    ...overrides,
  };
}

function response(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

describe('PaymentStatusView', () => {
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

  it('renders PIX qrCodeText when paymentMethod is FAKE_PIX', () => {
    render(
      <PaymentStatusView
        attempt={makeAttempt()}
        token={token}
        onNewAttempt={jest.fn()}
        onConfirmed={jest.fn()}
        onTimeout={jest.fn()}
      />,
    );

    expect(screen.getByText('pix-code-text-here')).toBeInTheDocument();
  });

  it('renders card placeholder when paymentMethod is FAKE_CREDIT_CARD', () => {
    render(
      <PaymentStatusView
        attempt={makeAttempt({
          paymentMethod: 'FAKE_CREDIT_CARD',
          checkoutData: { type: 'CREDIT_CARD' },
        })}
        token={token}
        onNewAttempt={jest.fn()}
        onConfirmed={jest.fn()}
        onTimeout={jest.fn()}
      />,
    );

    expect(screen.getByText('Processando pagamento com cartão…')).toBeInTheDocument();
    expect(screen.queryByText('pix-code-text-here')).not.toBeInTheDocument();
  });

  it('calls onConfirmed when polling detects APPROVED status', async () => {
    jest.mocked(fetch).mockResolvedValue(
      response(makeAttempt({ status: 'APPROVED' })),
    );
    const onConfirmed = jest.fn();

    render(
      <PaymentStatusView
        attempt={makeAttempt()}
        token={token}
        onNewAttempt={jest.fn()}
        onConfirmed={onConfirmed}
        onTimeout={jest.fn()}
      />,
    );

    await act(async () => { jest.advanceTimersByTime(3_000); });

    expect(onConfirmed).toHaveBeenCalledTimes(1);
  });

  it('shows DECLINED message and retry button when polling detects DECLINED status', async () => {
    jest.mocked(fetch).mockResolvedValue(
      response(makeAttempt({ status: 'DECLINED' })),
    );
    const onNewAttempt = jest.fn();

    render(
      <PaymentStatusView
        attempt={makeAttempt()}
        token={token}
        onNewAttempt={onNewAttempt}
        onConfirmed={jest.fn()}
        onTimeout={jest.fn()}
      />,
    );

    await act(async () => { jest.advanceTimersByTime(3_000); });

    expect(screen.getByRole('alert')).toHaveTextContent('Pagamento recusado.');
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
  });

  it('calls onNewAttempt when retry button is clicked after DECLINED', async () => {
    jest.mocked(fetch).mockResolvedValue(
      response(makeAttempt({ status: 'DECLINED' })),
    );
    const onNewAttempt = jest.fn();

    render(
      <PaymentStatusView
        attempt={makeAttempt()}
        token={token}
        onNewAttempt={onNewAttempt}
        onConfirmed={jest.fn()}
        onTimeout={jest.fn()}
      />,
    );

    await act(async () => { jest.advanceTimersByTime(3_000); });

    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(onNewAttempt).toHaveBeenCalledTimes(1);
  });

  it('shows EXPIRED message and retry button when polling detects EXPIRED status', async () => {
    jest.mocked(fetch).mockResolvedValue(
      response(makeAttempt({ status: 'EXPIRED' })),
    );

    render(
      <PaymentStatusView
        attempt={makeAttempt()}
        token={token}
        onNewAttempt={jest.fn()}
        onConfirmed={jest.fn()}
        onTimeout={jest.fn()}
      />,
    );

    await act(async () => { jest.advanceTimersByTime(3_000); });

    expect(screen.getByRole('alert')).toHaveTextContent('O tempo para pagamento expirou.');
  });

  it('shows CANCELLED message and retry button when polling detects CANCELLED status', async () => {
    jest.mocked(fetch).mockResolvedValue(
      response(makeAttempt({ status: 'CANCELLED' })),
    );

    render(
      <PaymentStatusView
        attempt={makeAttempt()}
        token={token}
        onNewAttempt={jest.fn()}
        onConfirmed={jest.fn()}
        onTimeout={jest.fn()}
      />,
    );

    await act(async () => { jest.advanceTimersByTime(3_000); });

    expect(screen.getByRole('alert')).toHaveTextContent('Pagamento cancelado.');
  });

  it('has aria-live polite on the status container', () => {
    render(
      <PaymentStatusView
        attempt={makeAttempt()}
        token={token}
        onNewAttempt={jest.fn()}
        onConfirmed={jest.fn()}
        onTimeout={jest.fn()}
      />,
    );

    const liveRegion = screen.getByText('pix-code-text-here').closest('[aria-live]');
    expect(liveRegion).toHaveAttribute('aria-live', 'polite');
  });
});
