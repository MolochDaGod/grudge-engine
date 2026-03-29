/**
 * grudge/auth.ts
 * Thin browser-side wrapper around Grudge ID API.
 * Mirrors the grudge-sdk.js auth module in TypeScript.
 */

const ID_URL    = import.meta.env.VITE_ID_URL  ?? 'https://id.grudge-studio.com'
const TOKEN_KEY = 'grudge_token'

export interface GrudgeUser {
  id:         string
  username:   string
  email?:     string
  grudge_id?: string
  roles?:     string[]
  avatar_url?: string
}

function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY)
}

function setToken(t: string | null): void {
  if (t) sessionStorage.setItem(TOKEN_KEY, t)
  else   sessionStorage.removeItem(TOKEN_KEY)
}

async function _post<T>(path: string, body: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const t = getToken(); if (t) headers.Authorization = `Bearer ${t}`
  const res  = await fetch(`${ID_URL}${path}`, { method: 'POST', headers, body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({})) as Record<string, unknown>
  if (!res.ok) throw new Error((data.error as string) ?? `Request failed (${res.status})`)
  return data as T
}

async function _get<T>(path: string): Promise<T> {
  const headers: Record<string, string> = {}
  const t = getToken(); if (t) headers.Authorization = `Bearer ${t}`
  const res  = await fetch(`${ID_URL}${path}`, { headers })
  const data = await res.json().catch(() => ({})) as Record<string, unknown>
  if (!res.ok) throw new Error((data.error as string) ?? `Request failed (${res.status})`)
  return data as T
}

export interface AuthResponse { token: string; user: GrudgeUser }

export const GrudgeAuth = {
  async login(identifier: string, password: string): Promise<AuthResponse> {
    const d = await _post<AuthResponse>('/auth/login', { identifier, password })
    setToken(d.token)
    return d
  },

  async register(username: string, password: string, email?: string): Promise<AuthResponse> {
    const d = await _post<AuthResponse>('/auth/register', { username, password, email })
    setToken(d.token)
    return d
  },

  /** Instant guest login — creates a Grudge ID backed by a puter device ID */
  async guest(): Promise<AuthResponse> {
    const deviceId = `web_${crypto.randomUUID().slice(0, 12)}`
    const d = await _post<AuthResponse>('/auth/guest', { deviceId })
    setToken(d.token)
    return d
  },

  /** Puter cloud auth — puter.js must be loaded on the page */
  async puter(): Promise<AuthResponse> {
    const p = (window as unknown as { puter?: { auth?: { signIn(): Promise<void>; getUser(): Promise<{ uuid: string; username: string }> } } }).puter
    if (!p?.auth) throw new Error('Puter SDK not loaded')
    await p.auth.signIn()
    const pu = await p.auth.getUser()
    const d  = await _post<AuthResponse>('/auth/puter', { puterUuid: pu.uuid, puterUsername: pu.username })
    setToken(d.token)
    return d
  },

  oauth(provider: 'discord' | 'google' | 'github', redirectUri?: string): void {
    const redir = redirectUri ?? window.location.origin + window.location.pathname
    window.location.href = `${ID_URL}/auth/${provider}?redirect_uri=${encodeURIComponent(redir)}`
  },

  async getUser(): Promise<GrudgeUser | null> {
    if (!getToken()) return null
    try {
      return await _get<GrudgeUser>('/auth/user')
    } catch {
      setToken(null)
      return null
    }
  },

  isLoggedIn(): boolean  { return !!getToken() },
  token():      string | null { return getToken() },

  async logout(): Promise<void> {
    try { await _post('/auth/logout', {}) } catch { /* ignore */ }
    setToken(null)
  },

  /** Call on page load to restore session from URL token or session storage */
  async init(): Promise<GrudgeUser | null> {
    const params = new URLSearchParams(window.location.search)
    const t = params.get('token') ?? params.get('sso_token')
    if (t) {
      setToken(t)
      window.history.replaceState({}, '', window.location.pathname)
    }
    return getToken() ? GrudgeAuth.getUser() : null
  },
}
