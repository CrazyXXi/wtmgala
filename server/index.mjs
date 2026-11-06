// API de la billetterie WTM Gala — zéro dépendance (Node 22+ : node:sqlite, fetch intégrés).
//   node server/index.mjs        (port 8787)
// Variables d'environnement :
//   RESEND_API_KEY  clé API Resend (https://resend.com) pour l'envoi réel des e-mails
//   MAIL_FROM       expéditeur, ex. "WTM Gala <billets@votre-domaine.com>" (domaine vérifié chez Resend)
//   SECRET          chaîne aléatoire longue pour signer les QR codes
//   PORT            port (défaut 8787)
// Sans RESEND_API_KEY (développement) : le code est affiché dans la console du serveur
// ET renvoyé au navigateur ("devCode"). En production (NODE_ENV=production) il n'est jamais renvoyé.

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const __dir = path.dirname(fileURLToPath(import.meta.url))
// Charge server/.env (jamais commité) sans dépendance
try {
  for (const l of fs.readFileSync(path.join(__dir, '.env'), 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
} catch { /* pas de .env */ }
const PORT = Number(process.env.PORT || 8787)
const PROD = process.env.NODE_ENV === 'production'
const RESEND_KEY = process.env.RESEND_API_KEY || ''
const MAIL_FROM = process.env.MAIL_FROM || 'WTM Gala <onboarding@resend.dev>'
const SECRET = process.env.SECRET || 'dev-secret-changez-moi'
if (PROD && SECRET === 'dev-secret-changez-moi') { console.error('SECRET obligatoire en production'); process.exit(1) }

/* ---------- Catalogue (miroir de app/src/data.ts ; le serveur fait foi pour prix et stock) ---------- */
const CATS = {
  communaute: { name: 'Communauté', price: 15000, quota: 120, base: 74 },
  standard: { name: 'Standard', price: 20000, quota: 200, base: 131 },
  premium: { name: 'Premium', price: 30000, quota: 80, base: 36 },
  vip: { name: 'VIP', price: 50000, quota: 40, base: 12 },
}

/* ---------- Base de données ---------- */
const db = new DatabaseSync(path.join(__dir, 'data.db'))
db.exec(`
PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,   -- un seul compte par e-mail, garanti par la base
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS codes(
  email TEXT PRIMARY KEY COLLATE NOCASE, hash TEXT NOT NULL, expires INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, sent_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sends(email TEXT COLLATE NOCASE, at INTEGER);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS orders(
  id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), cat TEXT NOT NULL, qty INTEGER NOT NULL,
  name TEXT NOT NULL, phone TEXT NOT NULL, total INTEGER NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS tickets(
  number TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), user_id INTEGER NOT NULL REFERENCES users(id),
  cat TEXT NOT NULL, holder TEXT NOT NULL, qr TEXT NOT NULL, used_at INTEGER
);
`)

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex')
const norm = (e) => String(e || '').trim().toLowerCase()
const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 254

/* ---------- E-mail ---------- */
async function sendMail(to, subject, html, text) {
  if (!RESEND_KEY) {
    console.log(`\n[MAIL – non envoyé, RESEND_API_KEY absent]\n  À : ${to}\n  ${subject}\n  ${text}\n`)
    return { sent: false }
  }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: MAIL_FROM, to: [to], subject, html, text }),
  })
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`)
  return { sent: true }
}
const codeMail = (code) => ({
  subject: `${code} est votre code de connexion – Le WTM Gala`,
  text: `Votre code de connexion : ${code}\nIl est valable 10 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.`,
  html: `<div style="font-family:Arial,sans-serif;max-width:460px;margin:auto;padding:28px;background:#FAF4EC;color:#1D1349;border-radius:16px">
<p style="font-size:14px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;margin:0 0 8px">Le WTM Gala</p>
<h1 style="font-size:22px;margin:0 0 14px">Votre code de connexion</h1>
<p style="font-size:38px;letter-spacing:.25em;font-weight:800;margin:10px 0 18px">${code}</p>
<p style="font-size:14px;margin:0">Il est valable 10 minutes. Si vous n’êtes pas à l’origine de cette demande, ignorez ce message.</p></div>`,
})

/* ---------- Utilitaires HTTP ---------- */
const json = (res, status, body, headers = {}) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers })
  res.end(JSON.stringify(body))
}
const readBody = (req) => new Promise((resolve, reject) => {
  let b = ''
  req.on('data', (c) => { b += c; if (b.length > 20000) { reject(new Error('too big')); req.destroy() } })
  req.on('end', () => { try { resolve(b ? JSON.parse(b) : {}) } catch { reject(new Error('json')) } })
})
const cookies = (req) => Object.fromEntries((req.headers.cookie || '').split(';').map((c) => c.trim().split('=')).filter((x) => x[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]))
const SESSION_MS = 30 * 24 * 3600 * 1000
const setCookie = (token, maxAge) => `wtm_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${PROD ? '; Secure' : ''}`
const userFrom = (req) => {
  const t = cookies(req).wtm_session
  if (!t) return null
  return db.prepare('SELECT u.id, u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>?').get(sha(t), Date.now()) || null
}
const sold = (cat) => db.prepare('SELECT COALESCE(SUM(qty),0) n FROM orders WHERE cat=?').get(cat).n
const left = (id) => Math.max(0, CATS[id].base - sold(id))

/* ---------- Routes ---------- */
async function api(req, res, url) {
  const route = `${req.method} ${url.pathname}`

  if (route === 'GET /api/stock') return json(res, 200, Object.fromEntries(Object.keys(CATS).map((id) => [id, left(id)])))

  if (route === 'POST /api/auth/request') {
    const email = norm((await readBody(req)).email)
    if (!validEmail(email)) return json(res, 400, { error: 'E-mail invalide.' })
    const now = Date.now()
    const prev = db.prepare('SELECT sent_at FROM codes WHERE email=?').get(email)
    if (prev && now - prev.sent_at < 45000) return json(res, 429, { error: 'Patientez un instant avant de redemander un code.' })
    db.prepare('DELETE FROM sends WHERE at<?').run(now - 3600000)
    if (db.prepare('SELECT COUNT(*) n FROM sends WHERE email=?').get(email).n >= 6) return json(res, 429, { error: 'Trop de demandes. Réessayez dans une heure.' })
    const code = String(crypto.randomInt(100000, 1000000))
    db.prepare('INSERT OR REPLACE INTO codes(email,hash,expires,attempts,sent_at) VALUES(?,?,?,0,?)').run(email, sha(email + ':' + code), now + 600000, now)
    db.prepare('INSERT INTO sends(email,at) VALUES(?,?)').run(email, now)
    const m = codeMail(code)
    try {
      const { sent } = await sendMail(email, m.subject, m.html, m.text)
      return json(res, 200, { ok: true, sent, ...(sent || PROD ? {} : { devCode: code }) })
    } catch (e) {
      console.error('Envoi e-mail impossible :', e.message)
      db.prepare('DELETE FROM codes WHERE email=?').run(email)
      return json(res, 502, { error: 'Envoi de l’e-mail impossible pour le moment. Réessayez.' })
    }
  }

  if (route === 'POST /api/auth/verify') {
    const b = await readBody(req)
    const email = norm(b.email), code = String(b.code || '').trim()
    const row = db.prepare('SELECT * FROM codes WHERE email=?').get(email)
    if (!row || row.expires < Date.now() || row.attempts >= 5) return json(res, 400, { error: 'Code expiré. Demandez-en un nouveau.' })
    if (!crypto.timingSafeEqual(Buffer.from(sha(email + ':' + code)), Buffer.from(row.hash))) {
      db.prepare('UPDATE codes SET attempts=attempts+1 WHERE email=?').run(email)
      return json(res, 400, { error: 'Code incorrect.' })
    }
    db.prepare('DELETE FROM codes WHERE email=?').run(email)
    // E-mail unique : INSERT OR IGNORE sur colonne UNIQUE ; on relit toujours le compte existant.
    db.prepare('INSERT OR IGNORE INTO users(email,created_at) VALUES(?,?)').run(email, Date.now())
    const user = db.prepare('SELECT id, email FROM users WHERE email=?').get(email)
    const token = crypto.randomBytes(32).toString('base64url')
    db.prepare('INSERT INTO sessions(token,user_id,expires) VALUES(?,?,?)').run(sha(token), user.id, Date.now() + SESSION_MS)
    return json(res, 200, { email: user.email }, { 'Set-Cookie': setCookie(token, SESSION_MS / 1000) })
  }

  if (route === 'GET /api/me') { const u = userFrom(req); return json(res, 200, { email: u ? u.email : null }) }

  if (route === 'POST /api/auth/logout') {
    const t = cookies(req).wtm_session
    if (t) db.prepare('DELETE FROM sessions WHERE token=?').run(sha(t))
    return json(res, 200, { ok: true }, { 'Set-Cookie': setCookie('', 0) })
  }

  if (route === 'GET /api/orders') {
    const u = userFrom(req)
    if (!u) return json(res, 401, { error: 'Connexion requise.' })
    const orders = db.prepare('SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC').all(u.id).map((o) => ({
      id: o.id, cat: o.cat, qty: o.qty, name: o.name, phone: o.phone, total: o.total, email: u.email,
      tickets: db.prepare('SELECT number, qr FROM tickets WHERE order_id=? ORDER BY number').all(o.id),
    }))
    return json(res, 200, { orders })
  }

  if (route === 'POST /api/orders') {
    const u = userFrom(req)
    if (!u) return json(res, 401, { error: 'Connectez-vous pour acheter.' })
    const b = await readBody(req)
    const cat = CATS[b.cat]
    const qty = Math.floor(Number(b.qty))
    const name = String(b.name || '').trim().slice(0, 120), phone = String(b.phone || '').trim().slice(0, 30)
    if (!cat || !(qty >= 1) || !name || phone.length < 8) return json(res, 400, { error: 'Commande invalide.' })
    // Paiement : à brancher (FedaPay / KkiaPay + webhook). Aujourd'hui la commande est validée directement (démo).
    try {
      db.exec('BEGIN IMMEDIATE')
      if (qty > left(b.cat)) { db.exec('ROLLBACK'); return json(res, 409, { error: `Il ne reste que ${left(b.cat)} place(s) en ${cat.name}.` }) }
      const id = String(crypto.randomInt(100000, 1000000))
      db.prepare('INSERT INTO orders(id,user_id,cat,qty,name,phone,total,created_at) VALUES(?,?,?,?,?,?,?,?)').run(id, u.id, b.cat, qty, name, phone, cat.price * qty, Date.now())
      const ins = db.prepare('INSERT INTO tickets(number,order_id,user_id,cat,holder,qr) VALUES(?,?,?,?,?,?)')
      for (let i = 0; i < qty; i++) {
        const number = `WTMG-2026-${id}${i ? '-' + (i + 1) : ''}`
        const sig = crypto.createHmac('sha256', SECRET).update(number).digest('base64url').slice(0, 16)
        ins.run(number, id, u.id, b.cat, name, `WTMG|${b.cat}|${number}|${sig}`)
      }
      db.exec('COMMIT')
      const o = db.prepare('SELECT * FROM orders WHERE id=?').get(id)
      const order = { id, cat: o.cat, qty, name, phone, total: o.total, email: u.email, tickets: db.prepare('SELECT number, qr FROM tickets WHERE order_id=? ORDER BY number').all(id) }
      sendMail(u.email, `Votre commande ${id} – Le WTM Gala`,
        `<p>Merci ! Votre commande <b>${id}</b> (${qty} × ${cat.name}) est confirmée. Retrouvez vos billets avec QR code dans « Mes billets » après connexion avec cet e-mail.</p>`,
        `Merci ! Votre commande ${id} (${qty} x ${cat.name}) est confirmée. Retrouvez vos billets dans « Mes billets » après connexion avec cet e-mail.`).catch((e) => console.error('Mail confirmation :', e.message))
      return json(res, 201, { order })
    } catch (e) { try { db.exec('ROLLBACK') } catch {} ; console.error(e); return json(res, 500, { error: 'Erreur serveur.' }) }
  }

  return json(res, 404, { error: 'Introuvable.' })
}

/* ---------- Fichiers statiques (production : app/dist) ---------- */
const DIST = path.join(__dir, '..', 'app', 'dist')
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json' }
function serveStatic(req, res, url) {
  let f = path.join(DIST, decodeURIComponent(url.pathname))
  if (!f.startsWith(DIST)) { res.writeHead(403); return res.end() }
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html')
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('Lancez "npm run build" dans app/') }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' })
  fs.createReadStream(f).pipe(res)
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x')
  try {
    if (url.pathname.startsWith('/api/')) await api(req, res, url)
    else serveStatic(req, res, url)
  } catch (e) {
    console.error(e)
    if (!res.headersSent) json(res, 400, { error: 'Requête invalide.' })
  }
}).listen(PORT, () => console.log(`API WTM Gala sur http://localhost:${PORT}  (e-mail : ${RESEND_KEY ? 'Resend actif' : 'MODE DÉV – codes affichés ici'})`))
