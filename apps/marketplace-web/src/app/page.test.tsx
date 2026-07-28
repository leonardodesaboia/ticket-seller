import { render, screen } from '@testing-library/react';
import Page from './page';

describe('Home page', () => {
  it('renders the main heading', () => {
    render(<Page />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('contains the brand name', () => {
    render(<Page />);
    expect(screen.getByText('Ticket Seller')).toBeInTheDocument();
  });
});
