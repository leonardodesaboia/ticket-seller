import { render, screen } from '@testing-library/react';
import { DecisionFeedback } from './DecisionFeedback';

describe('DecisionFeedback', () => {
  it('renders nothing when decision is null', () => {
    const { container } = render(<DecisionFeedback decision={null} allowed={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders ADMITTED with role="alert" and correct text', () => {
    render(<DecisionFeedback decision="ADMITTED" allowed={true} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Admitido')).toBeInTheDocument();
  });

  it('renders ALREADY_CHECKED_IN with correct text', () => {
    render(<DecisionFeedback decision="ALREADY_CHECKED_IN" allowed={false} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Já realizado check-in')).toBeInTheDocument();
  });

  it('renders INVALID_CREDENTIAL with correct text', () => {
    render(<DecisionFeedback decision="INVALID_CREDENTIAL" allowed={false} />);
    expect(screen.getByText('QR inválido')).toBeInTheDocument();
  });

  it('renders TICKET_CANCELLED with correct text', () => {
    render(<DecisionFeedback decision="TICKET_CANCELLED" allowed={false} />);
    expect(screen.getByText('Ingresso cancelado')).toBeInTheDocument();
  });

  it('renders EVENT_NOT_ACTIVE with correct text', () => {
    render(<DecisionFeedback decision="EVENT_NOT_ACTIVE" allowed={false} />);
    expect(screen.getByText('Evento não está ativo')).toBeInTheDocument();
  });

  it('renders WRONG_EVENT with correct text', () => {
    render(<DecisionFeedback decision="WRONG_EVENT" allowed={false} />);
    expect(screen.getByText('Ingresso de outro evento')).toBeInTheDocument();
  });

  it('renders TRANSFER_PENDING with correct text', () => {
    render(<DecisionFeedback decision="TRANSFER_PENDING" allowed={false} />);
    expect(screen.getByText('Transferência pendente')).toBeInTheDocument();
  });

  it('applies green styling for ADMITTED', () => {
    render(<DecisionFeedback decision="ADMITTED" allowed={true} />);
    const alert = screen.getByRole('alert');
    expect(alert.className).toContain('bg-green-100');
    expect(alert.className).toContain('text-green-800');
  });

  it('applies red styling for non-ADMITTED decisions', () => {
    render(<DecisionFeedback decision="ALREADY_CHECKED_IN" allowed={false} />);
    const alert = screen.getByRole('alert');
    expect(alert.className).toContain('bg-red-100');
    expect(alert.className).toContain('text-red-800');
  });

  it('shows checkmark icon for ADMITTED', () => {
    render(<DecisionFeedback decision="ADMITTED" allowed={true} />);
    expect(screen.getByText('✓')).toBeInTheDocument();
  });

  it('shows X icon for non-ADMITTED', () => {
    render(<DecisionFeedback decision="INVALID_CREDENTIAL" allowed={false} />);
    expect(screen.getByText('✗')).toBeInTheDocument();
  });
});
