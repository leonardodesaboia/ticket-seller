import { API_BASE_URL } from '@/shared/api/api-client';

export interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    displayName: string;
  };
}

export interface MeResponse {
  id: string;
  email: string;
  displayName: string;
}

export interface RefreshResponse {
  accessToken: string;
}

export class AuthError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    credentials: 'include',
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new AuthError(401, 'Email ou senha inválidos');
    }
    throw new AuthError(res.status, 'Erro ao fazer login');
  }

  return res.json() as Promise<LoginResponse>;
}

export async function logout(): Promise<void> {
  await fetch(`${API_BASE_URL}/api/v1/auth/logout`, {
    method: 'DELETE',
    credentials: 'include',
  });
}

export async function getMe(token: string): Promise<MeResponse> {
  const res = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  });

  if (!res.ok) {
    throw new AuthError(res.status, 'Sessão inválida');
  }

  return res.json() as Promise<MeResponse>;
}

export async function refreshToken(): Promise<RefreshResponse> {
  const res = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });

  if (!res.ok) {
    throw new AuthError(res.status, 'Sessão expirada');
  }

  return res.json() as Promise<RefreshResponse>;
}
