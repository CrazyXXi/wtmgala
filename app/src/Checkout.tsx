import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Category, fcfa, EVENT } from './data'
import TicketView from './TicketView'

export interface Order { id: string; cat: Category; qty: number; name: string; email: string; tickets: { number: string; qr: string }[] }

const MAX = 5
const METHODS = ['MTN MoMo', 'Moov Money', 'Celtiis Cash', 'Carte bancaire']

export const loadOrders = (): Order[] => { try { return JSON.parse(localStorage.getItem('wtm-orders') || '[]') } catch { return [] } }
const saveOrder = (o: Order) => { try { localStorage.setItem('wtm-orders', JSON.stringify([o, ...loadOrders()])) } catch { /* ignoré */ } }

export default function Checkout({ cat, qty: qty0, onClose, onDone }: { cat: Category; qty?: number; onClose: () => void; onDone: () => void }) {
  // Si la quantité est déjà choisie sur la page billets, on démarre directement aux infos.
  const [step, setStep] = useState(qty0 ? 1 : 0)
  const [qty, setQty] = useState(qty0 ?? 1)
  const [f, setF] = useState({ first: '', last: '', email: '', phone: '', ok: false })
  const [method, setMethod] = useState(METHODS[0])
  const [busy, setBusy] = useState(false)
  const [order, setOrder] = useState<Order | null>(null)
  const valid = f.first && f.last && /\S+@\S+\.\S+/.test(f.email) && f.phone.length >= 8 && f.ok

  const pay = () => {
    setBusy(true)
    // Démo : à remplacer par FedaPay / KkiaPay + webhook serveur avant émission du billet.
    setTimeout(() => {
      const id = String(Math.floor(Math.random() * 900000) + 100000)
      const o: Order = {
        id, cat, qty, name: `${f.first} ${f.last}`, email: f.email,
        tickets: Array.from({ length: qty }, (_, i) => {
          const number = `WTMG-2026-${id}${i ? '-' + (i + 1) : ''}`
          return { number, qr: `WTMG|${cat.id}|${number}|demo` }
        }),
      }
      saveOrder(o); setOrder(o); setBusy(false); setStep(3); onDone()
    }, 1900)
  }

  const steps = ['Billets', 'Vos infos', 'Paiement', 'Votre billet']
  return (
    <motion.div className="modal-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="modal" role="dialog" aria-modal="true" initial={{ y: 60, opacity: 0, scale: 0.97 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ type: 'spring', damping: 24, stiffness: 240 }} onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={onClose} aria-label="Fermer">×</button>
        <ol className="steps">{steps.map((s, i) => <li key={s} className={i === step ? 'on' : i < step ? 'done' : ''}>{s}</li>)}</ol>
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22 }}>
            {step === 0 && (
              <div className="pane">
                <p className="eyebrow">Catégorie {cat.name}</p>
                <h3>Combien de places ?</h3>
                <p className="muted">Jusqu’à {MAX} billets par commande.</p>
                <div className="qty">
                  <button onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Moins">−</button>
                  <b>{qty}</b>
                  <button onClick={() => setQty(Math.min(MAX, qty + 1))} aria-label="Plus">+</button>
                </div>
                <div className="total"><span>Total</span><b>{fcfa(cat.price * qty)}</b></div>
                <button className="btn" onClick={() => setStep(1)}>Continuer</button>
              </div>
            )}
            {step === 1 && (
              <form className="pane" onSubmit={(e) => { e.preventDefault(); if (valid) setStep(2) }}>
                <p className="eyebrow">Participant</p>
                <h3>Qui vient au Gala ?</h3>
                <div className="grid2">
                  <label>Prénom<input value={f.first} onChange={(e) => setF({ ...f, first: e.target.value })} autoComplete="given-name" /></label>
                  <label>Nom<input value={f.last} onChange={(e) => setF({ ...f, last: e.target.value })} autoComplete="family-name" /></label>
                </div>
                <label>E-mail<input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" /></label>
                <label>Numéro WhatsApp<input type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} autoComplete="tel" placeholder="+229 …" /></label>
                {cat.id === 'communaute' && <p className="note">Catégorie Communauté : un justificatif (carte étudiante ou lien de profil) pourra vous être demandé.</p>}
                <label className="check"><input type="checkbox" checked={f.ok} onChange={(e) => setF({ ...f, ok: e.target.checked })} /> J’accepte que mes données (nom, e-mail, téléphone) servent à émettre mon billet.</label>
                <button className="btn" disabled={!valid}>Continuer</button>
              </form>
            )}
            {step === 2 && (
              <div className="pane">
                <p className="eyebrow">Paiement</p>
                <h3>{fcfa(cat.price * qty)}</h3>
                <div className="methods">
                  {METHODS.map((m) => <button key={m} className={m === method ? 'on' : ''} onClick={() => setMethod(m)}>{m}</button>)}
                </div>
                <p className="note">Mode démonstration : aucun paiement réel n’est effectué.</p>
                <button className="btn" onClick={pay} disabled={busy}>{busy ? 'Paiement en cours…' : `Payer avec ${method}`}</button>
              </div>
            )}
            {step === 3 && order && (
              <div className="pane">
                <p className="eyebrow">Commande {order.id}</p>
                <h3>C’est confirmé, <em>à bientôt</em></h3>
                <p className="muted">Un e-mail et un message WhatsApp vous enverront {order.qty > 1 ? 'vos billets' : 'votre billet'}. {EVENT.dateLong}.</p>
                <div className="reveal">
                  {order.tickets.map((t, i) => (
                    <motion.div key={t.number} initial={{ y: -80, rotate: -6 + i * 3, opacity: 0 }} animate={{ y: 0, rotate: 0, opacity: 1 }} transition={{ delay: 0.15 + i * 0.18, type: 'spring', damping: 14, stiffness: 120 }}>
                      <TicketView cat={cat} opts={{ name: order.name, number: t.number, qr: t.qr }} />
                    </motion.div>
                  ))}
                </div>
                <button className="btn" onClick={onClose}>Fermer</button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}
