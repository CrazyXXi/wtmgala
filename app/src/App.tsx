import { useEffect, useState, MouseEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import Ribbon from './Ribbon'
import TicketView from './TicketView'
import Billets from './Billets'
import Checkout, { loadOrders } from './Checkout'
import { CATEGORIES, CatId, byId, fcfa, EVENT } from './data'

const FAQ = [
  ['Comment je reçois mon billet ?', 'Dès le paiement confirmé, par e-mail et par WhatsApp, avec un QR code. Vous pouvez aussi le retrouver dans « Mes billets ».'],
  ['Comment payer ?', 'Par Mobile Money (MTN MoMo, Moov Money, Celtiis Cash) ou par carte bancaire.'],
  ['Le QR code peut-il servir deux fois ?', 'Non. Chaque QR code n’est accepté qu’une seule fois à l’entrée.'],
  ['Qui peut prendre la catégorie Communauté ?', 'Les étudiantes et les membres de la communauté. Un justificatif peut être demandé.'],
  ['Où et à quelle heure ?', 'Le lieu et l’heure des portes seront confirmés très bientôt.'],
]

const reveal = { initial: { opacity: 0, y: 40 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: '-80px' }, transition: { duration: 0.6 } }

/* Mini routeur : "/" (accueil) et "/billets" */
const parse = () => {
  const cat = new URLSearchParams(location.search).get('cat') as CatId | null
  return { page: location.pathname.startsWith('/billets') ? 'billets' : 'home', cat: CATEGORIES.some((c) => c.id === cat) ? (cat as CatId) : 'standard' }
}

export default function App() {
  const [route, setRoute] = useState(parse)
  const [buy, setBuy] = useState<{ id: CatId; qty: number } | null>(null)
  const [orders, setOrders] = useState(loadOrders)
  const [open, setOpen] = useState<number | null>(0)
  const [onSky, setOnSky] = useState(true)
  useEffect(() => {
    const f = () => {
      const t = document.getElementById('track')
      setOnSky(!t || scrollY < t.offsetHeight - innerHeight * 0.6)
    }
    f(); addEventListener('scroll', f, { passive: true })
    return () => removeEventListener('scroll', f)
  }, [route.page])
  const [view, setView] = useState<{ id: CatId; name: string; number: string; qr: string } | null>(null)

  useEffect(() => {
    const on = () => setRoute(parse())
    addEventListener('popstate', on)
    return () => removeEventListener('popstate', on)
  }, [])

  const go = (url: string) => {
    history.pushState(null, '', url)
    setRoute(parse())
    const hash = url.split('#')[1]
    requestAnimationFrame(() => (hash ? document.getElementById(hash)?.scrollIntoView() : scrollTo(0, 0)))
  }
  const link = (url: string) => (e: MouseEvent) => { e.preventDefault(); go(url) }

  const navEl = (
    <header className={route.page === 'home' && onSky ? 'nav onsky' : 'nav'}>
        <a className="brand" href="/" onClick={link('/')}><img src="/logo.png" alt="Women Techmakers Abomey-Calavi" /></a>
        <nav>
          <a href="/" onClick={link('/')}>Accueil</a>
          <a href="/#mes-billets" onClick={link('/#mes-billets')}>Mes billets</a>
          <a href="/#faq" onClick={link('/#faq')}>FAQ</a>
        </nav>
        {route.page === 'home' && <a className="btn sm" href="/billets" onClick={link('/billets')}>Prendre ma place</a>}
      </header>
  )

  return (
    <>

      {route.page === 'billets' ? (
        <>
          {navEl}
          <Billets key={route.cat} initial={route.cat} onStart={(id, qty) => setBuy({ id, qty })} />
        </>
      ) : (
        <>
          <Ribbon onPick={(id) => go(`/billets?cat=${id}`)}>{navEl}</Ribbon>
          <main>
            <section className="sec cta">
              <motion.div {...reveal}>
                <p className="eyebrow lime">Billets</p>
                <h2>Quatre façons de <em>venir</em></h2>
                <p className="lead">{EVENT.dateLong} · {EVENT.place}</p>
              </motion.div>
              <div className="chips">
                {CATEGORIES.map((c, i) => (
                  <motion.a key={c.id} href={`/billets?cat=${c.id}`} onClick={link(`/billets?cat=${c.id}`)} className="chip" style={{ background: c.main, color: c.onMain, boxShadow: c.main === '#1D1349' ? 'inset 0 0 0 2px rgba(255,255,255,.35)' : undefined }} {...reveal} transition={{ duration: 0.5, delay: i * 0.08 }} whileHover={{ y: -6 }}>
                    <b>{c.name}</b><span>{fcfa(c.price)}</span><small>{c.who}</small>
                  </motion.a>
                ))}
              </div>
              <a className="btn big" href="/billets" onClick={link('/billets')}>Voir les billets →</a>
            </section>

            <section id="mes-billets" className="sec cream">
              <motion.div {...reveal}>
                <p className="eyebrow">Mes billets</p>
                <h2>Retrouvez vos billets</h2>
                {orders.length === 0 && <p className="lead">Vous n’avez pas encore de billet sur cet appareil.</p>}
              </motion.div>
              <div className="mine-list">
                {orders.flatMap((o) => o.tickets.map((t) => (
                  <div key={t.number} className="mt-row">
                    <i style={{ background: byId(o.cat.id).main }} />
                    <div><b>{byId(o.cat.id).name} · {o.name}</b><small>{t.number}</small></div>
                    <button onClick={() => setView({ id: o.cat.id, name: o.name, number: t.number, qr: t.qr })}>Voir</button>
                  </div>
                )))}
              </div>
            </section>

            <section id="faq" className="sec">
              <motion.div {...reveal}><p className="eyebrow lime">FAQ</p><h2>Questions fréquentes</h2></motion.div>
              <div className="faq">
                {FAQ.map(([q, a], i) => (
                  <div key={q} className={open === i ? 'q on' : 'q'}>
                    <button onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>{q}<span>+</span></button>
                    <AnimatePresence initial={false}>
                      {open === i && <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>{a}</motion.p>}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </section>
          </main>
        </>
      )}

      <footer className="foot">
        <b>Women Techmakers</b>
        <span>Le WTM Gala · {EVENT.dateLong}</span>
      </footer>

      <AnimatePresence>
        {view && (
          <motion.div className="modal-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setView(null)}>
            <motion.div className="viewer" initial={{ y: 40, scale: 0.96 }} animate={{ y: 0, scale: 1 }} onClick={(e) => e.stopPropagation()}>
              <TicketView cat={byId(view.id)} opts={{ name: view.name, number: view.number, qr: view.qr }} />
              <button className="btn" onClick={() => setView(null)}>Fermer</button>
            </motion.div>
          </motion.div>
        )}
        {buy && <Checkout key={buy.id} cat={byId(buy.id)} qty={buy.qty} onClose={() => setBuy(null)} onDone={() => setOrders(loadOrders())} />}
      </AnimatePresence>
    </>
  )
}
