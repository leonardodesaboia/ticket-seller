import { render, screen } from '@testing-library/react';
import Page from './page';

describe('Backoffice home page', () => {
  it('renders the main heading', () => {
    render(<Page />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('contains the application name', () => {
    render(<Page />);
    expect(screen.getByText('Backoffice')).toBeInTheDocument();
  });

  it('renders a main landmark', () => {
    render(<Page />);
    expect(screen.getByRole('main')).toBeInTheDocument();
  });
});
