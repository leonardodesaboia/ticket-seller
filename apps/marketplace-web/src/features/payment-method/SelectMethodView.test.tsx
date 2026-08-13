import { fireEvent, render, screen } from '@testing-library/react';
import { SelectMethodView } from './SelectMethodView';

describe('SelectMethodView', () => {
  it('renders both payment method buttons', () => {
    render(<SelectMethodView onSelect={jest.fn()} isCreating={false} />);

    expect(screen.getByRole('button', { name: 'Pagar com PIX' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pagar com Cartão' })).toBeInTheDocument();
  });

  it('calls onSelect with FAKE_PIX when PIX button is clicked', () => {
    const onSelect = jest.fn();
    render(<SelectMethodView onSelect={onSelect} isCreating={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Pagar com PIX' }));

    expect(onSelect).toHaveBeenCalledWith('FAKE_PIX');
  });

  it('calls onSelect with FAKE_CREDIT_CARD when card button is clicked', () => {
    const onSelect = jest.fn();
    render(<SelectMethodView onSelect={onSelect} isCreating={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Pagar com Cartão' }));

    expect(onSelect).toHaveBeenCalledWith('FAKE_CREDIT_CARD');
  });

  it('disables both buttons and sets aria-busy when isCreating is true', () => {
    render(<SelectMethodView onSelect={jest.fn()} isCreating={true} />);

    const pixButton = screen.getByRole('button', { name: 'Pagar com PIX' });
    const cardButton = screen.getByRole('button', { name: 'Pagar com Cartão' });

    expect(pixButton).toBeDisabled();
    expect(cardButton).toBeDisabled();
    expect(pixButton).toHaveAttribute('aria-busy', 'true');
    expect(cardButton).toHaveAttribute('aria-busy', 'true');
  });

  it('does not call onSelect when buttons are disabled (double-click protection)', () => {
    const onSelect = jest.fn();
    render(<SelectMethodView onSelect={onSelect} isCreating={true} />);

    const pixButton = screen.getByRole('button', { name: 'Pagar com PIX' });
    fireEvent.click(pixButton);

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('displays an error message with role=alert when error is provided', () => {
    render(
      <SelectMethodView
        onSelect={jest.fn()}
        isCreating={false}
        error="Erro ao criar pagamento. Tente novamente."
      />,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Erro ao criar pagamento. Tente novamente.');
  });

  it('does not render an alert when there is no error', () => {
    render(<SelectMethodView onSelect={jest.fn()} isCreating={false} />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
