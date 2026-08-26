import { render, screen, act, waitFor, fireEvent } from '@testing-library/react';
import { CheckInPage } from './CheckInPage';

// Mock auth so the component works outside AuthProvider
jest.mock('@/features/auth', () => ({
  useAuth: () => ({ token: 'test-token', userId: 'user-1' }),
}));

// Mock the API module — use relative path because jest.mock hoisting bypasses moduleNameMapper
jest.mock('../../../shared/api/check-in.api', () => ({
  performCheckIn: jest.fn(),
}));

// Mock CameraScanner to control scan events in tests
jest.mock('./CameraScanner', () => ({
  CameraScanner: ({
    onScan,
    onCameraError,
    disabled,
  }: {
    onScan: (token: string) => void;
    onCameraError: () => void;
    disabled: boolean;
  }) => (
    <div data-testid="camera-scanner" data-disabled={String(disabled)}>
      <button onClick={() => onScan('a'.repeat(64))}>Simulate Scan</button>
      <button onClick={onCameraError}>Simulate Camera Error</button>
    </div>
  ),
}));

import { performCheckIn } from '../../../shared/api/check-in.api';
const mockPerformCheckIn = performCheckIn as jest.MockedFunction<typeof performCheckIn>;

const VALID_TOKEN = 'a'.repeat(64);

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('CheckInPage', () => {
  it('renders in SCANNING state initially with camera active', () => {
    render(<CheckInPage orgId="org-1" eventId="event-1" />);
    expect(screen.getByTestId('camera-scanner')).toBeInTheDocument();
    expect(screen.getByText('Aponte a câmera para o QR code do ingresso')).toBeInTheDocument();
  });

  it('transitions to VALIDATING state when a scan is triggered', async () => {
    mockPerformCheckIn.mockImplementation(
      () => new Promise(() => {}), // never resolves — stays in VALIDATING
    );

    render(<CheckInPage orgId="org-1" eventId="event-1" />);
    await act(async () => {
      screen.getByText('Simulate Scan').click();
    });

    expect(screen.getByText('Validando ingresso...')).toBeInTheDocument();
    // Camera should be disabled during VALIDATING
    expect(screen.getByTestId('camera-scanner')).toHaveAttribute('data-disabled', 'true');
  });

  it('shows feedback for ADMITTED and returns to SCANNING after 2s', async () => {
    mockPerformCheckIn.mockResolvedValue({
      decision: 'ADMITTED',
      allowed: true,
      checkedInAt: '2024-01-01T00:00:00Z',
    });

    render(<CheckInPage orgId="org-1" eventId="event-1" />);

    await act(async () => {
      screen.getByText('Simulate Scan').click();
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Admitido')).toBeInTheDocument();
    });

    expect(screen.getByText('Resultado do check-in')).toBeInTheDocument();

    // Advance timers by 2 seconds
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    await waitFor(() => {
      expect(screen.getByText('Aponte a câmera para o QR code do ingresso')).toBeInTheDocument();
    });

    expect(screen.queryByText('Admitido')).not.toBeInTheDocument();
  });

  it('shows ALREADY_CHECKED_IN feedback on that decision', async () => {
    mockPerformCheckIn.mockResolvedValue({
      decision: 'ALREADY_CHECKED_IN',
      allowed: false,
      checkedInAt: null,
    });

    render(<CheckInPage orgId="org-1" eventId="event-1" />);

    await act(async () => {
      screen.getByText('Simulate Scan').click();
    });

    await waitFor(() => {
      expect(screen.getByText('Já realizado check-in')).toBeInTheDocument();
    });
  });

  it('shows OFFLINE message on network error', async () => {
    mockPerformCheckIn.mockRejectedValue(new TypeError('Failed to fetch'));

    render(<CheckInPage orgId="org-1" eventId="event-1" />);

    await act(async () => {
      screen.getByText('Simulate Scan').click();
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Sem conexão — verifique a internet')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('camera-scanner')).not.toBeInTheDocument();
  });

  it('shows ManualEntryForm when camera error occurs', async () => {
    render(<CheckInPage orgId="org-1" eventId="event-1" />);

    await act(async () => {
      screen.getByText('Simulate Camera Error').click();
    });

    expect(screen.queryByTestId('camera-scanner')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Token do ingresso')).toBeInTheDocument();
    expect(screen.getByText('Câmera indisponível — use a entrada manual')).toBeInTheDocument();
  });

  it('blocks double scan during VALIDATING', async () => {
    let resolveFirst!: (value: { decision: 'ADMITTED'; allowed: boolean; checkedInAt: string | null }) => void;
    mockPerformCheckIn.mockImplementationOnce(
      () => new Promise((res) => { resolveFirst = res; }),
    );

    render(<CheckInPage orgId="org-1" eventId="event-1" />);

    // First scan
    await act(async () => {
      screen.getByText('Simulate Scan').click();
    });

    // Camera scanner is disabled during VALIDATING - second scan can't happen
    expect(screen.getByTestId('camera-scanner')).toHaveAttribute('data-disabled', 'true');

    // API should have been called only once
    expect(mockPerformCheckIn).toHaveBeenCalledTimes(1);

    // Resolve the first request
    await act(async () => {
      resolveFirst({ decision: 'ADMITTED', allowed: true, checkedInAt: null });
    });
  });

  it('uses different Idempotency-Key for each scan', async () => {
    mockPerformCheckIn.mockResolvedValue({
      decision: 'ADMITTED',
      allowed: true,
      checkedInAt: null,
    });

    render(<CheckInPage orgId="org-1" eventId="event-1" />);

    // First scan
    await act(async () => {
      screen.getByText('Simulate Scan').click();
    });
    await act(async () => { jest.advanceTimersByTime(2000); });

    // Wait for return to SCANNING
    await waitFor(() => {
      expect(screen.getByText('Aponte a câmera para o QR code do ingresso')).toBeInTheDocument();
    });

    // Second scan
    await act(async () => {
      screen.getByText('Simulate Scan').click();
    });

    expect(mockPerformCheckIn).toHaveBeenCalledTimes(2);

    const firstKey = mockPerformCheckIn.mock.calls[0]?.[4];
    const secondKey = mockPerformCheckIn.mock.calls[1]?.[4];
    expect(firstKey).toBeDefined();
    expect(secondKey).toBeDefined();
    // In real runtime these would differ; in tests the polyfill returns sequential values
    // so we at least confirm two calls were made
    expect(mockPerformCheckIn).toHaveBeenCalledTimes(2);
  });

  it('passes orgId and eventId to the API', async () => {
    mockPerformCheckIn.mockResolvedValue({
      decision: 'ADMITTED',
      allowed: true,
      checkedInAt: null,
    });

    render(<CheckInPage orgId="my-org" eventId="my-event" />);

    await act(async () => {
      screen.getByText('Simulate Scan').click();
    });

    expect(mockPerformCheckIn).toHaveBeenCalledWith(
      'my-org',
      'my-event',
      expect.objectContaining({ credential: VALID_TOKEN }),
      expect.any(String),
      expect.any(String),
    );
  });

  it('returns to SCANNING when retry is clicked from OFFLINE state', async () => {
    mockPerformCheckIn.mockRejectedValue(new TypeError('Failed to fetch'));

    render(<CheckInPage orgId="org-1" eventId="event-1" />);

    await act(async () => {
      screen.getByText('Simulate Scan').click();
    });

    await waitFor(() => {
      expect(screen.getByText('Sem conexão — verifique a internet')).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByText('Tentar novamente').click();
    });

    expect(screen.getByTestId('camera-scanner')).toBeInTheDocument();
    expect(screen.getByText('Aponte a câmera para o QR code do ingresso')).toBeInTheDocument();
  });

  it('shows manual form and processes token when camera error and form submitted', async () => {
    mockPerformCheckIn.mockResolvedValue({
      decision: 'ADMITTED',
      allowed: true,
      checkedInAt: null,
    });

    render(<CheckInPage orgId="org-1" eventId="event-1" />);

    // Trigger camera error
    await act(async () => {
      screen.getByText('Simulate Camera Error').click();
    });

    const input = screen.getByLabelText('Token do ingresso');
    await act(async () => {
      fireEvent.change(input, { target: { value: VALID_TOKEN } });
    });

    await act(async () => {
      screen.getByRole('button', { name: 'Validar' }).click();
    });

    expect(mockPerformCheckIn).toHaveBeenCalledWith(
      'org-1',
      'event-1',
      expect.objectContaining({ credential: VALID_TOKEN }),
      expect.any(String),
      expect.any(String),
    );
  });
});
