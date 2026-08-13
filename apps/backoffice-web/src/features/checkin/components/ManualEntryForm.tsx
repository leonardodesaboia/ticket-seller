'use client';

import { useState } from 'react';

const HEX_64_REGEX = /^[0-9a-fA-F]{64}$/;

interface ManualEntryFormProps {
  onSubmit: (token: string) => void;
  isLoading?: boolean;
}

export function ManualEntryForm({ onSubmit, isLoading = false }: ManualEntryFormProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();

    if (!HEX_64_REGEX.test(trimmed)) {
      setError('Token inválido — deve ter 64 caracteres hexadecimais.');
      return;
    }

    setError(null);
    onSubmit(trimmed);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="token-input" className="text-sm font-medium text-foreground">
          Token do ingresso
        </label>
        <input
          id="token-input"
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Cole ou digite o token do QR code (64 caracteres hex)"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          aria-describedby={error ? 'token-error' : undefined}
          disabled={isLoading}
          autoComplete="off"
        />
        {error && (
          <p id="token-error" role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Validando...' : 'Validar'}
      </button>
    </form>
  );
}
