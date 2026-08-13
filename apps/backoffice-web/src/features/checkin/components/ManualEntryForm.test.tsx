import { render, screen, fireEvent } from '@testing-library/react';
import { ManualEntryForm } from './ManualEntryForm';

const VALID_TOKEN = 'a'.repeat(64);
const INVALID_TOKEN_SHORT = 'abc123';
const INVALID_TOKEN_NON_HEX = 'z'.repeat(64);

describe('ManualEntryForm', () => {
  it('renders the form with label and button', () => {
    render(<ManualEntryForm onSubmit={jest.fn()} />);
    expect(screen.getByLabelText('Token do ingresso')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Validar' })).toBeInTheDocument();
  });

  it('calls onSubmit with token when valid 64-char hex is submitted', () => {
    const onSubmit = jest.fn();
    render(<ManualEntryForm onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('Token do ingresso'), {
      target: { value: VALID_TOKEN },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Validar' }));
    expect(onSubmit).toHaveBeenCalledWith(VALID_TOKEN);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('does not call onSubmit when token is too short', () => {
    const onSubmit = jest.fn();
    render(<ManualEntryForm onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('Token do ingresso'), {
      target: { value: INVALID_TOKEN_SHORT },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Validar' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('does not call onSubmit when token is non-hex', () => {
    const onSubmit = jest.fn();
    render(<ManualEntryForm onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('Token do ingresso'), {
      target: { value: INVALID_TOKEN_NON_HEX },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Validar' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not call onSubmit when token is empty', () => {
    const onSubmit = jest.fn();
    render(<ManualEntryForm onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Validar' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('disables button when isLoading is true', () => {
    render(<ManualEntryForm onSubmit={jest.fn()} isLoading={true} />);
    expect(screen.getByRole('button', { name: 'Validando...' })).toBeDisabled();
  });

  it('disables input when isLoading is true', () => {
    render(<ManualEntryForm onSubmit={jest.fn()} isLoading={true} />);
    expect(screen.getByLabelText('Token do ingresso')).toBeDisabled();
  });

  it('shows error message for invalid token', () => {
    render(<ManualEntryForm onSubmit={jest.fn()} />);
    fireEvent.change(screen.getByLabelText('Token do ingresso'), {
      target: { value: 'short' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Validar' }));
    expect(screen.getByText(/Token inválido/)).toBeInTheDocument();
  });

  it('accepts uppercase hex characters', () => {
    const onSubmit = jest.fn();
    render(<ManualEntryForm onSubmit={onSubmit} />);
    const uppercaseHex = 'A'.repeat(64);
    fireEvent.change(screen.getByLabelText('Token do ingresso'), {
      target: { value: uppercaseHex },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Validar' }));
    expect(onSubmit).toHaveBeenCalledWith(uppercaseHex);
  });
});
