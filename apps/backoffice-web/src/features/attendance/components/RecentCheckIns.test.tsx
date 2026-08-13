import { render, screen } from '@testing-library/react';
import { RecentCheckIns } from './RecentCheckIns';
import type { RecentCheckIn } from '@/shared/api/attendance.api';

const mockItems: RecentCheckIn[] = [
  {
    checkedInAt: '2026-08-13T20:00:00Z',
    ticketTypeName: 'Inteira',
    performedByUserId: 'a1b2c3d4',
  },
  {
    checkedInAt: '2026-08-13T19:55:00Z',
    ticketTypeName: 'Meia',
    performedByUserId: 'sistema',
  },
];

describe('RecentCheckIns', () => {
  it('renders the list of check-ins with type and operator', () => {
    render(<RecentCheckIns items={mockItems} />);

    expect(screen.getByText('Inteira')).toBeInTheDocument();
    expect(screen.getByText('Meia')).toBeInTheDocument();
    expect(screen.getByText('a1b2c3d4')).toBeInTheDocument();
    expect(screen.getByText('sistema')).toBeInTheDocument();
  });

  it('displays "Nenhum check-in registrado" when list is empty', () => {
    render(<RecentCheckIns items={[]} />);

    expect(screen.getByTestId('no-checkins')).toHaveTextContent('Nenhum check-in registrado');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('does not render empty state when items exist', () => {
    render(<RecentCheckIns items={mockItems} />);

    expect(screen.queryByTestId('no-checkins')).not.toBeInTheDocument();
  });
});
