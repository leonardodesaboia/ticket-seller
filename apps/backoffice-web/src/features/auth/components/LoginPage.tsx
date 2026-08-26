'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/shared/ui/primitives/button';
import { cn } from '@/shared/lib/utils';
import { AuthError } from '../api/auth.api';
import { useAuth } from '../hooks/useAuth';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginFormData) {
    try {
      await login(data.email, data.password);
      router.push('/');
    } catch (err) {
      if (err instanceof AuthError && err.status === 401) {
        setError('root', { message: 'Email ou senha inválidos' });
      } else {
        setError('root', { message: 'Erro ao fazer login. Tente novamente.' });
      }
    }
  }

  const inputClass = (hasError: boolean) =>
    cn(
      'rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground w-full',
      'placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring',
      hasError && 'border-destructive',
    );

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 text-2xl font-bold text-foreground">Entrar</h1>
        <p className="mb-6 text-sm text-muted-foreground">Backoffice — Ticket Seller</p>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-sm font-medium text-foreground">
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="seu@email.com"
              autoComplete="email"
              {...register('email')}
              className={inputClass(!!errors.email)}
            />
            {errors.email && (
              <span className="text-xs text-destructive">{errors.email.message}</span>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-sm font-medium text-foreground">
              Senha
            </label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              {...register('password')}
              className={inputClass(!!errors.password)}
            />
            {errors.password && (
              <span className="text-xs text-destructive">{errors.password.message}</span>
            )}
          </div>

          {errors.root && (
            <p className="text-sm text-destructive">{errors.root.message}</p>
          )}

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
      </div>
    </main>
  );
}
