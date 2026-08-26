'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '@/shared/ui/primitives/button';
import { cn } from '@/shared/lib/utils';
import { useCreateOrganization } from '../hooks/use-create-organization';
import { createOrganizationSchema, type CreateOrganizationFormData } from '../schemas';
import type { Organization } from '../types';

interface CreateOrganizationFormProps {
  onSuccess: (org: Organization) => void;
}

export function CreateOrganizationForm({ onSuccess }: CreateOrganizationFormProps) {
  const mutation = useCreateOrganization();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateOrganizationFormData>({
    resolver: zodResolver(createOrganizationSchema),
  });

  async function onSubmit(data: CreateOrganizationFormData) {
    try {
      const org = await mutation.mutateAsync(data);
      onSuccess(org);
    } catch {
      // error handled via mutation.error
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium text-foreground">
          Nome
        </label>
        <input
          id="name"
          type="text"
          placeholder="Nome da organização"
          {...register('name')}
          className={cn(
            'rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground',
            'placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring',
            errors.name && 'border-destructive',
          )}
        />
        {errors.name && <span className="text-xs text-destructive">{errors.name.message}</span>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="slug" className="text-sm font-medium text-foreground">
          Slug
        </label>
        <input
          id="slug"
          type="text"
          placeholder="minha-organizacao"
          {...register('slug')}
          className={cn(
            'rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground',
            'placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring',
            errors.slug && 'border-destructive',
          )}
        />
        {errors.slug && <span className="text-xs text-destructive">{errors.slug.message}</span>}
      </div>

      {mutation.isError && (
        <p className="text-sm text-destructive">
          {mutation.error instanceof Error ? mutation.error.message : 'Erro desconhecido'}
        </p>
      )}

      <Button type="submit" disabled={isSubmitting || mutation.isPending}>
        {mutation.isPending ? 'Criando...' : 'Criar organização'}
      </Button>
    </form>
  );
}
