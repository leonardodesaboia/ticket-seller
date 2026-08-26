// Stub API client — will be replaced by a generated client from the OpenAPI spec.

export const API_BASE_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3000';

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });

  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

/**
 * Creates an authenticated fetch function that:
 * - Injects Authorization: Bearer <token> into every request
 * - On 401, calls the refresh endpoint and retries the original request once
 * - On second 401 (after refresh), calls onUnauthorized (e.g. redirect to /login)
 */
export function createAuthenticatedFetch(
  getToken: () => string | null,
  onUnauthorized: () => void,
) {
  async function doRefresh(): Promise<string | null> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { accessToken: string };
      return data.accessToken;
    } catch {
      return null;
    }
  }

  return async function authenticatedFetch(
    path: string,
    init?: RequestInit,
  ): Promise<Response> {
    const token = getToken();
    const headers = new Headers(init?.headers);
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const url = `${API_BASE_URL}${path}`;
    let response = await fetch(url, { ...init, headers, credentials: 'include' });

    if (response.status === 401) {
      const newToken = await doRefresh();
      if (newToken) {
        headers.set('Authorization', `Bearer ${newToken}`);
        response = await fetch(url, { ...init, headers, credentials: 'include' });
      }
      if (response.status === 401) {
        onUnauthorized();
      }
    }

    return response;
  };
}
