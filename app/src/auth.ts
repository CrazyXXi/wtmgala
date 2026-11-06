/* Client de l'API (server/index.mjs). Comptes, codes, sessions et commandes vivent côté serveur. */

export const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim())

async function call<T>(path: string, body?: unknown): Promise<T> {
  let r: Response
  try {
    r = await fetch(path, { method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new Error('Serveur injoignable. Vérifiez votre connexion.')
  }
  const data = await r.json().catch(() => null)
  if (data === null) throw new Error('Le service de connexion n’est pas encore disponible sur ce site.')
  if (!r.ok) throw new Error((data as { error?: string }).error || 'Une erreur est survenue.')
  return data as T
}

export interface Order { id: string; cat: string; qty: number; name: string; phone: string; total: number; email: string; tickets: { number: string; qr: string }[] }

/* MODE DÉMO (par défaut) : tout reste dans le navigateur, le code s'affiche à l'écran, aucun e-mail n'est envoyé.
   Pour utiliser le vrai serveur (server/index.mjs) : définir VITE_USE_API=1 au build. */
const USE_API = import.meta.env.VITE_USE_API === '1'
const read = <T,>(k: string, d: T): T => { try { return JSON.parse(localStorage.getItem(k) || '') as T } catch { return d } }
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* ignoré */ } }
const norm = (e: string) => e.trim().toLowerCase()
let pending: { email: string; code: string; at: number } | null = null
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const demo = {
  async requestCode(email: string) {
    await sleep(600)
    const code = String(Math.floor(Math.random() * 900000) + 100000)
    pending = { email: norm(email), code, at: Date.now() }
    return { ok: true as const, sent: false, devCode: code }
  },
  async verifyCode(email: string, code: string) {
    await sleep(400)
    if (!pending || pending.email !== norm(email) || pending.code !== code.trim() || Date.now() - pending.at > 600000) throw new Error('Code incorrect ou expiré.')
    const accounts = new Set(read<string[]>('wtm-accounts', []))
    accounts.add(pending.email) // un seul compte par e-mail
    write('wtm-accounts', [...accounts]); write('wtm-user', pending.email)
    const e = pending.email; pending = null
    return { email: e }
  },
  async getUser() { return read<string | null>('wtm-user', null) },
  async logout() { try { localStorage.removeItem('wtm-user') } catch { /* ignoré */ } },
  async fetchOrders() { const u = read<string | null>('wtm-user', null); return read<Order[]>('wtm-orders-v2', []).filter((o) => o.email === u) },
  async createOrder(b: { cat: string; qty: number; name: string; phone: string }) {
    const email = read<string | null>('wtm-user', null)
    if (!email) throw new Error('Connectez-vous pour acheter.')
    const id = String(Math.floor(Math.random() * 900000) + 100000)
    const order: Order = {
      id, cat: b.cat, qty: b.qty, name: b.name, phone: b.phone, total: 0, email,
      tickets: Array.from({ length: b.qty }, (_, i) => { const number = `WTMG-2026-${id}${i ? '-' + (i + 1) : ''}`; return { number, qr: `WTMG|${b.cat}|${number}|demo` } }),
    }
    write('wtm-orders-v2', [order, ...read<Order[]>('wtm-orders-v2', [])])
    return order
  },
}

export const requestCode = (email: string) => (USE_API ? call<{ ok: true; sent: boolean; devCode?: string }>('/api/auth/request', { email }) : demo.requestCode(email))
export const verifyCode = (email: string, code: string) => (USE_API ? call<{ email: string }>('/api/auth/verify', { email, code }) : demo.verifyCode(email, code))
export const getUser = async (): Promise<string | null> => (USE_API ? (await call<{ email: string | null }>('/api/me').catch(() => ({ email: null }))).email : demo.getUser())
export const logout = () => (USE_API ? call('/api/auth/logout', {}).catch(() => undefined) : demo.logout())
export const fetchOrders = async (): Promise<Order[]> => (USE_API ? (await call<{ orders: Order[] }>('/api/orders').catch(() => ({ orders: [] }))).orders : demo.fetchOrders())
export const createOrder = (b: { cat: string; qty: number; name: string; phone: string }) => (USE_API ? call<{ order: Order }>('/api/orders', b).then((r) => r.order) : demo.createOrder(b))
export const fetchStock = () => (USE_API ? call<Record<string, number>>('/api/stock').catch(() => null) : Promise.resolve(null))
