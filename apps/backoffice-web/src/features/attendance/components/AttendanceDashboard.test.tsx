import { render, screen, waitFor } from '@testing-library/react';
import { AttendanceDashboard } from './AttendanceDashboard';
import type { AttendanceResponse } from '../../../shared/api/attendance.api';

// Mock the polling hook — use relative path to bypass moduleNameMapper hoisting
jest.mock('../hooks/useAttendancePolling', () => ({
  useAttendancePolling: jest.fn(),
}));

import { useAttendancePolling } from '../hooks/useAttendancePolling';
const mockUseAttendancePolling = useAttendancePolling as jest.MockedFunction<typeof useAttendancePolling>;

const mockData: AttendanceResponse = {
  totalIssued: 100,
  totalAdmitted: 60,
  totalRemaining: 40,
  attendanceRate: 60.0,
  byTicketType: [
    { ticketTypeId: 'tt-1', ticketTypeName: 'Inteira', totalIssued: 100, totalAdmitted: 60 },
  ],
  recentCheckIns: [
    {
      checkedInAt: '2026-08-13T20:00:00Z',
      ticketTypeName: 'Inteira',
      performedByUserId: 'a1b2c3d4',
    },
  ],
};

describe('AttendanceDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading state initially when data is null', () => {
    mockUseAttendancePolling.mockReturnValue({ data: null, error: null });

    render(<AttendanceDashboard orgId="org-1" eventId="event-1" />);

    expect(screen.getByText('Carregando...')).toBeInTheDocument();
  });

  it('renders data when polling resolves', async () => {
    mockUseAttendancePolling.mockReturnValue({ data: mockData, error: null });

    render(<AttendanceDashboard orgId="org-1" eventId="event-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('total-issued')).toHaveTextContent('100');
      expect(screen.getByTestId('total-admitted')).toHaveTextContent('60');
    });

    // 'Inteira' appears in both byTicketType table and recentCheckIns table
    expect(screen.getAllByText('Inteira').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('a1b2c3d4')).toBeInTheDocument();
  });

  it('shows error alert when polling fails', () => {
    mockUseAttendancePolling.mockReturnValue({
      data: null,
      error: new Error('attendance fetch failed: 500'),
    });

    render(<AttendanceDashboard orgId="org-1" eventId="event-1" />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Erro ao carregar dados de presença. Tente novamente em instantes.');
  });

  it('passes orgId and eventId to the polling hook', () => {
    mockUseAttendancePolling.mockReturnValue({ data: null, error: null });

    render(<AttendanceDashboard orgId="my-org" eventId="my-event" />);

    expect(mockUseAttendancePolling).toHaveBeenCalledWith('my-org', 'my-event');
  });
});
