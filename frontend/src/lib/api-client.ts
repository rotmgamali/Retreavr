const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api/v1'

// --- Token management ---------------------------------------------------

let accessToken: string | null = null

function getStoredTokens() {
  if (typeof window === 'undefined') return { access: null, refresh: null }
  
  const access = localStorage.getItem('access_token')
  const refresh = localStorage.getItem('refresh_token')
  
  return { access, refresh }
}

function storeTokens(access: string, refresh: string) {
  accessToken = access
  localStorage.setItem('access_token', access)
  localStorage.setItem('refresh_token', refresh)
}

function clearTokens() {
  accessToken = null
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
}

function getAccessToken(): string | null {
  return accessToken ?? getStoredTokens().access
}

// --- Refresh logic -------------------------------------------------------

let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const { refresh } = getStoredTokens()
  if (!refresh) return null

  // Deduplicate concurrent refresh calls
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refresh }),
      })
      if (!res.ok) {
        clearTokens()
        return null
      }
      const data = await res.json()
      accessToken = data.access_token
      localStorage.setItem('access_token', data.access_token)
      return data.access_token as string
    } catch {
      clearTokens()
      return null
    } finally {
      refreshPromise = null
    }
  })()

  return refreshPromise
}

// --- ApiError ------------------------------------------------------------

class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    message?: string
  ) {
    super(message ?? `API Error: ${status} ${statusText}`)
    this.name = 'ApiError'
  }
}

// --- Tenant context for superadmin impersonation -------------------------

function getActiveTenantId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem('retrevr-active-tenant')
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.state?.activeTenantId ?? null
  } catch {
    return null
  }
}

// --- Core request with auto-refresh + auth header ------------------------

async function request<T>(
  path: string,
  options: RequestInit = {},
  _retry = true
): Promise<T> {
  const url = `${API_BASE_URL}${path}`
  const token = getAccessToken()
  const tenantId = getActiveTenantId()

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(tenantId ? { 'X-Tenant-Id': tenantId } : {}),
    ...options.headers,
  }

  const res = await fetch(url, { ...options, headers })

    // Auto-refresh on 401
    if (res.status === 401 && _retry) {
      const newToken = await refreshAccessToken()
      if (newToken) {
        return request<T>(path, options, false)
      }
      clearTokens()
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
      throw new ApiError(401, 'Unauthorized', 'Session expired')
    }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new ApiError(res.status, res.statusText, body || undefined)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// --- Public API ----------------------------------------------------------

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, formData: FormData) =>
    request<T>(path, {
      method: 'POST',
      body: formData,
      headers: {}, // Let browser set Content-Type with boundary
    }),

  // --- Analytics & Dashboard -----------------------------------------------

  getAnalytics: async (range: string = '7d') => {
    return request<Record<string, unknown>>(`/analytics/summary?range=${range}`)
  },

  getConversionAnalytics: async (days: number = 30) => {
    return request<Record<string, unknown>>(`/analytics/conversion?days=${days}`)
  },

  getCallVolume: async (range: string = '7d') => {
    return request<Record<string, unknown>>(`/analytics/calls/volume?range=${range}`)
  },

  getLiveAgents: async () => {
    return request<Record<string, unknown>[]>('/analytics/agents/live')
  },

  getDashboardSummary: async () => {
    return request<Record<string, unknown>>('/dashboard/summary')
  },
}

// --- Auth helpers (used by auth context) ---------------------------------

export const authApi = {
  login: async (email: string, password: string) => {
    const data = await request<{ access_token: string; refresh_token: string }>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      },
      false // Don't retry on 401
    )
    storeTokens(data.access_token, data.refresh_token)
    return data
  },

  register: async (payload: {
    email: string
    password: string
    first_name: string
    last_name: string
    organization_id?: string
  }) => {
    return request<{ id: string; email: string }>(
      '/auth/register',
      { method: 'POST', body: JSON.stringify(payload) },
      false
    )
  },

  logout: async () => {
    const { refresh } = getStoredTokens()
    if (refresh) {
      try {
        await request('/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refresh_token: refresh }),
        }, false)
      } catch {
        // Ignore errors on logout
      }
    }
    clearTokens()
  },

  getMe: () => request<UserProfile>('/auth/me'),

  isAuthenticated: () => !!getAccessToken(),
}

// --- Shared types --------------------------------------------------------

export interface UserProfile {
  id: string
  email: string
  first_name: string
  last_name: string
  role: string
  organization_id: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  limit: number
  offset: number
}

export { ApiError }
