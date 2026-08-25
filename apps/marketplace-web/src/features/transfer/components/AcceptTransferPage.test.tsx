import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AcceptTransferPage } from './AcceptTransferPage';

const claimToken = 'claim-token-abc';

function response(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

describe('AcceptTransferPage', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    // Mock crypto.randomUUID
    Object.defineProperty(global, 'crypto', {
      value: { randomUUID: jest.fn().mockReturnValue('test-idempotency-key') },
      writable: true,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('shows the accept button in the initial state', () => {
    render(<AcceptTransferPage claimToken={claimToken} />);

    expect(screen.getByRole('button', { name: 'Aceitar' })).toBeInTheDocument();
    expect(screen.getByText('Você recebeu um ingresso. Deseja aceitar?')).toBeInTheDocument();
  });

  it('shows success message after accepting transfer', async () => {
    jest.mocked(fetch).mockResolvedValueOnce(
      response({ newCredentialToken: 'new-secret-token' }),
    );

    render(<AcceptTransferPage claimToken={claimToken} />);

    fireEvent.click(screen.getByRole('button', { name: 'Aceitar' }));

    await waitFor(() => {
      expect(
        screen.getByText('Ingresso transferido! Você já pode gerar seu novo QR Code no app.'),
      ).toBeInTheDocument();
    });

    // Ensure the token is never displayed
    expect(screen.queryByText('new-secret-token')).not.toBeInTheDocument();
  });

  it('shows expired message for TRANSFER_EXPIRED error (400)', async () => {
    jest.mocked(fetch).mockResolvedValueOnce(
      response({ code: 'TRANSFER_EXPIRED' }, false, 400),
    );

    render(<AcceptTransferPage claimToken={claimToken} />);

    fireEvent.click(screen.getByRole('button', { name: 'Aceitar' }));

    await waitFor(() => {
      expect(screen.getByText('Link expirado')).toBeInTheDocument();
    });
  });

  it('shows already transferred message for TRANSFER_ALREADY_ACCEPTED error (409)', async () => {
    jest.mocked(fetch).mockResolvedValueOnce(
      response({ code: 'TRANSFER_ALREADY_ACCEPTED' }, false, 409),
    );

    render(<AcceptTransferPage claimToken={claimToken} />);

    fireEvent.click(screen.getByRole('button', { name: 'Aceitar' }));

    await waitFor(() => {
      expect(screen.getByText('Ingresso já transferido')).toBeInTheDocument();
    });
  });
});
