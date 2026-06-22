import * as SecureStore from 'expo-secure-store';

// ─── Config ───────────────────────────────────────────────────────────────────
const BASE_URL_KEY = 'server_base_url';
const COOKIE_KEY = 'driver_session_cookie';

export async function getBaseUrl(): Promise<string> {
  return (await SecureStore.getItemAsync(BASE_URL_KEY)) ?? '';
}
export async function setBaseUrl(url: string): Promise<void> {
  await SecureStore.setItemAsync(BASE_URL_KEY, url.replace(/\/$/, ''));
}
export async function getSessionCookie(): Promise<string> {
  return (await SecureStore.getItemAsync(COOKIE_KEY)) ?? '';
}
export async function setSessionCookie(cookie: string): Promise<void> {
  await SecureStore.setItemAsync(COOKIE_KEY, cookie);
}
export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(COOKIE_KEY);
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────
async function apiFetch<T>(
  path: string,
  options?: RequestInit,
  timeoutMs = 10000,
): Promise<{ data: T; setCookie?: string }> {
  const base = await getBaseUrl();
  if (!base) throw new Error('Server URL not configured');

  const cookie = await getSessionCookie();

  // Guard against fetch() hanging indefinitely on a slow/unreachable server.
  // Without this, app startup (getSession/getBaseUrl) can get stuck forever,
  // which looks identical to a frozen splash screen.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {}),
        ...(options?.headers ?? {}),
      },
      signal: controller.signal,
      ...options,
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms: ${path}`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  // Capture session cookie from response so we can persist it
  const setCookie = res.headers.get('set-cookie') ?? undefined;

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status}: ${text}`);
  }

  const data = await res.json();
  return { data, setCookie };
}

// ─── Auth — uses existing /api/auth/* endpoints ───────────────────────────────

export interface SessionUser {
  id: number;
  username: string;
  role: 'driver';
  driverId: number;
  driverName?: string;  // may not be in session — fetched separately
}

/**
 * Login with username + password.
 * Uses the existing POST /api/auth/driver-login endpoint.
 * Returns the session user and persists the session cookie.
 */
export async function loginDriver(username: string, password: string): Promise<SessionUser> {
  const { data, setCookie } = await apiFetch<{ user: SessionUser }>(
    '/api/auth/driver-login',
    {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    },
  );

  // Persist the session cookie so all future requests are authenticated
  if (setCookie) {
    const cookieValue = (setCookie ?? '').split(';')[0];
    await setSessionCookie(cookieValue);
  }

  return data.user;
}

/**
 * Check if the stored session cookie is still valid.
 * Uses the existing GET /api/auth/session endpoint.
 */
export async function getSession(): Promise<SessionUser | null> {
  try {
    const { data } = await apiFetch<{ user: SessionUser | null }>('/api/auth/session');
    return data.user;
  } catch {
    return null;
  }
}

/**
 * Logout — clears the server session and the locally stored cookie.
 */
export async function logoutDriver(): Promise<void> {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' });
  } catch {}
  await clearSession();
}

// ─── Routes — uses existing /api/drivers/:id/routes endpoint ─────────────────

export async function fetchDriverRoutes(driverId: number) {
  const { data } = await apiFetch<import('../types').Route[]>(
    `/api/drivers/${driverId}/routes`,
  );
  return data;
}

export async function fetchRoute(routeId: number) {
  const { data } = await apiFetch<{
    route: import('../types').Route;
    stops: import('../types').RouteStop[];
  }>(`/api/routes/${routeId}`);
  // API returns { route: {...}, stops: [...] } as separate top-level keys
  // Merge stops into the route object so the rest of the app works naturally
  const route = (data as any).route ?? data;
  const stops = (data as any).stops ?? route.stops ?? [];
  return { ...route, stops } as import('../types').Route;
}

// ─── Stop actions — all existing endpoints ────────────────────────────────────

export async function completeStop(routeId: number, stopId: number) {
  const { data } = await apiFetch<{ ok: boolean }>(
    `/api/routes/${routeId}/stops/${stopId}/complete`,
    { method: 'POST' },
  );
  return data;
}

export async function completeStopLocal(
  routeId: number,
  stopId: number,
  body: { localProofId: string; recipientName?: string; notes?: string },
) {
  const { data } = await apiFetch<{ ok: boolean }>(
    `/api/routes/${routeId}/stops/${stopId}/complete-local`,
    { method: 'POST', body: JSON.stringify(body) },
  );
  return data;
}

export async function scanPackage(routeId: number, stopId: number, barcode: string) {
  const { data } = await apiFetch<{ ok: boolean }>(
    `/api/routes/${routeId}/stops/${stopId}/scan`,
    { method: 'POST', body: JSON.stringify({ barcode }) },
  );
  return data;
}

export async function markStopUrgent(routeId: number, stopId: number) {
  const { data } = await apiFetch<{ ok: boolean }>(
    `/api/routes/${routeId}/stops/${stopId}/urgent`,
    { method: 'POST' },
  );
  return data;
}

export async function uploadProof(
  routeId: number,
  stopId: number,
  proofData: {
    localProofId: string;
    signatureData?: string;
    photoBase64?: string;
    recipientName?: string;
    notes?: string;
  },
) {
  // Server expects: { signature, picture, notes, localProofId }
  // NOT signatureData / photoBase64 — must map field names correctly
  const body: Record<string, any> = {
    localProofId: proofData.localProofId,
  };
  if (proofData.signatureData) body.signature = proofData.signatureData;
  if (proofData.photoBase64)   body.picture   = proofData.photoBase64;
  if (proofData.notes)         body.notes     = proofData.notes;

  // Server requires at least one of: signature, picture, notes, barcode
  // If none present, skip the upload — the stop is already marked complete
  if (!body.signature && !body.picture && !body.notes) return { ok: true };

  const { data } = await apiFetch<{ proof: any; stop: any; message: string }>(
    `/api/routes/${routeId}/stops/${stopId}/proof`,
    { method: 'POST', body: JSON.stringify(body) },
  );
  return data;
}

export async function updateDriverLocation(driverId: number, lat: number, lng: number) {
  const { data } = await apiFetch<{ ok: boolean }>(
    `/api/drivers/${driverId}/location`,
    { method: 'POST', body: JSON.stringify({ lat, lng }) },
  );
  return data;
}

// ─── Fetch driver name (used after login since session may not include it) ────
export async function fetchDriverName(driverId: number): Promise<string> {
  try {
    const { data } = await apiFetch<{ id: number; name: string }>(`/api/drivers/${driverId}`);
    return data.name ?? 'Driver';
  } catch {
    return 'Driver';
  }
}
