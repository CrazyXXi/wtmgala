/* Connexion par e-mail + code à 6 chiffres.
   MODE DÉMO : le code est généré ici et affiché à l'écran, la session est dans localStorage.
   Pour la production, remplacer requestCode / verifyCode par l'envoi réel (Supabase, Firebase, API maison)
   en gardant la même signature : le reste du site n'a pas à changer. */

const KEY = 'wtm-user'
const norm = (e: string) => e.trim().toLowerCase()
export const validEmail = (e: string) => /^\S+@\S+\.\S+$/.test(e.trim())

export const getUser = (): string | null => {
  try { return localStorage.getItem(KEY) } catch { return null }
}

let pending: { email: string; code: string; at: number } | null = null

/** Envoie un code. En démo, le code est renvoyé pour être affiché. */
export async function requestCode(email: string): Promise<{ demoCode: string }> {
  await new Promise((r) => setTimeout(r, 700))
  const code = String(Math.floor(Math.random() * 900000) + 100000)
  pending = { email: norm(email), code, at: Date.now() }
  return { demoCode: code }
}

/** Vérifie le code (valable 10 min) et ouvre la session. */
export async function verifyCode(email: string, code: string): Promise<boolean> {
  await new Promise((r) => setTimeout(r, 500))
  const p = pending
  if (!p || p.email !== norm(email) || p.code !== code.trim() || Date.now() - p.at > 600000) return false
  try { localStorage.setItem(KEY, p.email) } catch { /* ignoré */ }
  pending = null
  return true
}

export const logout = () => { try { localStorage.removeItem(KEY) } catch { /* ignoré */ } }
export const sameEmail = (a: string, b: string) => norm(a) === norm(b)
