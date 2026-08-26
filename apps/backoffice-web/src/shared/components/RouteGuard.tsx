'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/features/auth';

const PUBLIC_PATHS = ['/login'];

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const { token, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));

  useEffect(() => {
    if (isLoading) return;
    if (!token && !isPublic) {
      router.replace('/login');
    }
    if (token && isPublic) {
      router.replace('/');
    }
  }, [token, isLoading, isPublic, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!token && !isPublic) {
    return null;
  }

  return <>{children}</>;
}
