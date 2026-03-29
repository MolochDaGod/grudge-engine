/**
 * grudge/api.ts
 * Grudge Game API client for browser use.
 * Reads token from sessionStorage (set by GrudgeAuth).
 */

const API_URL   = import.meta.env.VITE_API_URL ?? 'https://api.grudge-studio.com'
const TOKEN_KEY = 'grudge_token'

function headers(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  const t = sessionStorage.getItem(TOKEN_KEY)
  if (t) h.Authorization = `Bearer ${t}`
  return h
}

async function apiFetch<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res  = await fetch(`${API_URL}${path}`, {
    method,
    headers: headers(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({})) as Record<string, unknown>
  if (!res.ok) throw new Error((data.error as string) ?? `API error (${res.status})`)
  return data as T
}

export const GrudgeAPI = {
  get:  <T>(path: string)              => apiFetch<T>('GET', path),
  post: <T>(path: string, body: unknown) => apiFetch<T>('POST', path, body),

  // ── Game shortcuts ──────────────────────────────────────────
  characters: ()          => GrudgeAPI.get<unknown[]>('/characters'),
  character:  (id: string)=> GrudgeAPI.get<unknown>(`/characters/${id}`),
  islands:    ()          => GrudgeAPI.get<unknown[]>('/islands'),
  missions:   ()          => GrudgeAPI.get<unknown[]>('/missions'),
  leaderboard:()          => GrudgeAPI.get<unknown[]>('/combat/leaderboard'),
  recipes:    (cls?: string, tier?: number) => {
    let q = '/crafting/recipes?'
    if (cls)  q += `class=${cls}&`
    if (tier) q += `tier=${tier}`
    return GrudgeAPI.get<unknown[]>(q)
  },
  balance: (charId: string) => GrudgeAPI.get<unknown>(`/economy/balance?char_id=${charId}`),

  // ── AI proxy (fallback from puter.js) ──────────────────────
  aiChat: (message: string) => GrudgeAPI.post<{ content: string }>('/ai/chat', { message }),
}
