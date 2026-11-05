import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import TicketView from './TicketView'
import { CATEGORIES, CatId, byId, fcfa, EVENT } from './data'

export default function Billets({ initial, onStart }: { initial: CatId; onStart: (id: CatId, qty: number) => void }) {
  const [id, setId] = useState<CatId>(initial)
  const [qty, setQty] = useState(1)
  const cat = byId(id)

  return (
    <section className="bp">
      <motion.div className="bp-head" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
        <p className="eyebrow lime">Billetterie</p>
        <h1>Choisissez votre <em>place</em></h1>
        <p className="lead">{EVENT.dateLong} · {EVENT.place}</p>
      </motion.div>

      <div className="bp-tabs" role="tablist" aria-label="Catégories de billets">
        {CATEGORIES.map((c) => (
          <button key={c.id} role="tab" aria-selected={c.id === id} className={c.id === id ? 'on' : ''} onClick={() => setId(c.id)}>
            <span>{c.name}</span><small>{fcfa(c.price)}</small>
            {c.id === id && <motion.i layoutId="tab-pill" className="tab-pill" />}
          </button>
        ))}
      </div>

      <div className="bp-grid">
        <div className="bp-ticket">
          <AnimatePresence mode="wait">
            <motion.div key={id} initial={{ opacity: 0, y: 40, rotate: -3 }} animate={{ opacity: 1, y: 0, rotate: 0 }} exit={{ opacity: 0, y: -30, rotate: 2 }} transition={{ type: 'spring', damping: 18, stiffness: 160 }}>
              <TicketView cat={cat} />
            </motion.div>
          </AnimatePresence>
        </div>

        <AnimatePresence mode="wait">
          <motion.aside key={id} className="bp-info" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
            <div className="bp-row">
              <h2>{cat.name}</h2>
              <div className="bp-price">{fcfa(cat.price)}</div>
            </div>

            <div className="bp-block">
              <h3>Pour qui</h3>
              <p>{cat.who}</p>
            </div>

            <div className="bp-block">
              <h3>Ce qui est inclus</h3>
              <ul className="bp-perks">
                {cat.perks.map((p, i) => (
                  <motion.li key={p} initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.07 }}>
                    <svg viewBox="0 0 20 20" aria-hidden><path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    {p}
                  </motion.li>
                ))}
              </ul>
            </div>

            <div className="bp-buy">
              <div className="bp-qty">
                <span>Places</span>
                <div className="qty">
                  <button onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Moins">−</button>
                  <b>{qty}</b>
                  <button onClick={() => setQty(Math.min(cat.left, qty + 1))} aria-label="Plus">+</button>
                </div>
              </div>
              <div className="bp-total"><span>Total</span><b>{fcfa(cat.price * qty)}</b></div>
              <button className="btn big" onClick={() => onStart(id, qty)}>Commencer avec mes infos →</button>
              <small>{cat.left} places restantes · pas de limite par commande tant qu’il en reste</small>
            </div>
          </motion.aside>
        </AnimatePresence>
      </div>
    </section>
  )
}
