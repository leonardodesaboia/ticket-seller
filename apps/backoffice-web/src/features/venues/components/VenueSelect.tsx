'use client';

import { useState } from 'react';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/primitives/button';
import { useListVenues } from '../hooks/use-list-venues';
import type { Venue } from '../types';
import { CreateVenueForm } from './CreateVenueForm';

interface VenueSelectProps {
  organizationId: string;
  value: string | null | undefined;
  onChange: (venueId: string | null) => void;
  disabled?: boolean;
  hasError?: boolean;
}

export function VenueSelect({
  organizationId,
  value,
  onChange,
  disabled,
  hasError,
}: VenueSelectProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const { data: venues = [], isLoading, refetch } = useListVenues(organizationId);

  function handleVenueCreated(venue: Venue) {
    void refetch();
    onChange(venue.id);
    setShowCreateForm(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <select
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
          disabled={disabled || isLoading}
          className={cn(
            'flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground',
            'focus:outline-none focus:ring-2 focus:ring-ring',
            hasError && 'border-destructive',
          )}
        >
          <option value="">Nenhum local selecionado</option>
          {venues.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name} — {v.city}, {v.state}
            </option>
          ))}
        </select>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowCreateForm((s) => !s)}
          disabled={disabled}
        >
          {showCreateForm ? 'Cancelar' : '+ Novo local'}
        </Button>
      </div>

      {showCreateForm && (
        <div className="rounded-md border border-border bg-muted/30 p-4">
          <p className="mb-3 text-sm font-medium">Criar novo local</p>
          <CreateVenueForm
            organizationId={organizationId}
            onSuccess={handleVenueCreated}
            onCancel={() => setShowCreateForm(false)}
          />
        </div>
      )}
    </div>
  );
}
