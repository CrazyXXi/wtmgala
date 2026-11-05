import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { requestCode, verifyCode, validEmail } from './auth'

export default function Login({ onClose, onDone }: { onClose: () => void; onDone: (email: string) => void }) {
  const [step, setStep] = useState<0 | 1>(0)
  const [email, setEmail] = useState('')
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''))
  const [demo, setDemo] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const refs = useRef<(HTMLInputElement | null)[]>([])

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!validEmail(email) || busy) return
    setBusy(true); setErr('')
    const { demoCode } = await requestCode(email)
    setDemo(demoCode); setDigits(Array(6).fill('')); setStep(1); setBusy(false)
    setTimeout(() => refs.current[0]?.focus(), 250)
  }

  const check = async (d: string[]) => {
    const code = d.join('')
    if (code.length < 6 || busy) return
    setBusy(true); setErr('')
    if (await verifyCode(email, code)) onDone(email.trim().toLowerCase())
    else { setErr('Code incorrect ou expiré.'); setDigits(Array(6).fill('')); refs.current[0]?.focus() }
    setBusy(false)
  }

  const setDigit = (i: number, v: string) => {
    const s = v.replace(/\D/g, '')
    if (s.length > 1) { // collage du code entier
      const d = s.slice(0, 6).split('').concat(Array(6).fill('')).slice(0, 6)
      setDigits(d); refs.current[Math.min(s.length, 5)]?.focus(); check(d); return
    }
    const d = digits.map((x, k) => (k === i ? s : x))
    setDigits(d)
    if (s && i < 5) refs.current[i + 1]?.focus()
    if (d.every(Boolean)) check(d)
  }

  return (
    <motion.div className="modal-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="modal login" role="dialog" aria-modal="true" aria-label="Connexion" initial={{ y: 60, opacity: 0, scale: 0.97 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ type: 'spring', damping: 24, stiffness: 240 }} onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={onClose} aria-label="Fermer">×</button>
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22 }}>
            {step === 0 ? (
              <form className="pane" onSubmit={send}>
                <p className="eyebrow">Connexion</p>
                <h3>Retrouvez vos billets</h3>
                <p className="muted">Entrez votre e-mail, nous vous envoyons un code à 6 chiffres. Pas de mot de passe.</p>
                <label>E-mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoFocus placeholder="vous@exemple.com" /></label>
                <button className="btn" disabled={!validEmail(email) || busy}>{busy ? 'Envoi…' : 'Recevoir mon code'}</button>
              </form>
            ) : (
              <div className="pane">
                <p className="eyebrow">Code envoyé</p>
                <h3>Saisissez le code</h3>
                <p className="muted">Code envoyé à <b>{email}</b>.</p>
                <div className="otp">
                  {digits.map((d, i) => (
                    <input key={i} ref={(el) => { refs.current[i] = el }} value={d} inputMode="numeric" autoComplete={i === 0 ? 'one-time-code' : 'off'} maxLength={6} aria-label={`Chiffre ${i + 1}`}
                      onChange={(e) => setDigit(i, e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Backspace' && !d && i > 0) refs.current[i - 1]?.focus() }} />
                  ))}
                </div>
                {err && <p className="err" role="alert">{err}</p>}
                <p className="note">Mode démonstration : aucun e-mail n’est réellement envoyé. Votre code : <b>{demo}</b></p>
                <button className="btn" onClick={() => check(digits)} disabled={busy || digits.some((x) => !x)}>{busy ? 'Vérification…' : 'Me connecter'}</button>
                <button className="linkbtn" onClick={() => { setStep(0); setErr('') }}>Changer d’e-mail</button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}
