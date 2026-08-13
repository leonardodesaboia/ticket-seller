import { render, screen } from '@testing-library/react';
import { AttendanceStats } from './AttendanceStats';
import type { AttendanceResponse } from '@/shared/api/attendance.api';

const mockData: AttendanceResponse = {
  totalIssued: 150,
  totalAdmitted: 87,
  totalRemaining: 63,
  attendanceRate: 58.0,
  byTicketType: [
    { ticketTypeId: 'tt-1', ticketTypeName: 'Inteira', totalIssued: 100, totalAdmitted: 60 },
    { ticketTypeId: 'tt-2', ticketTypeName: 'Meia', totalIssued: 50, totalAdmitted: 27 },
  ],
  recentCheckIns: [],
};

describe('AttendanceStats', () => {
  it('renders correct totals when data is provided', () => {
    render(<AttendanceStats data={mockData} />);

    expect(screen.getByTestId('total-issued')).toHaveTextContent('150');
    expect(screen.getByTestId('total-admitted')).toHaveTextContent('87');
    expect(screen.getByTestId('total-remaining')).toHaveTextContent('63');
    expect(screen.getByTestId('attendance-rate')).toHaveTextContent('58.0%');
  });

  it('renders ticket type breakdown table', () => {
    render(<AttendanceStats data={mockData} />);

    expect(screen.getByText('Inteira')).toBeInTheDocument();
    expect(screen.getByText('Meia')).toBeInTheDocument();
  });

  it('renders zeros when data is null', () => {
    render(<AttendanceStats data={null} />);

    expect(screen.getByTestId('total-issued')).toHaveTextContent('0');
    expect(screen.getByTestId('total-admitted')).toHaveTextContent('0');
    expect(screen.getByTestId('total-remaining')).toHaveTextContent('0');
    expect(screen.getByTestId('attendance-rate')).toHaveTextContent('0.0%');
  });

  it('does not render the ticket type table when byTicketType is empty', () => {
    render(
      <AttendanceStats
        data={{ ...mockData, byTicketType: [] }}
      />,
    );

    expect(screen.queryByText('Por tipo de ingresso')).not.toBeInTheDocument();
  });
});
