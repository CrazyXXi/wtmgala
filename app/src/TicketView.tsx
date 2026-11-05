import { useEffect, useRef } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react'
import { Category } from './data'
import { drawTicket, loadFonts, TicketOpts } from './ticketArt'

/** Billet 2D avec inclinaison 3D au survol et reflet qui suit le pointeur. */
export default function TicketView({ cat, opts, tilt = true, className = '' }: { cat: Category; opts?: TicketOpts; tilt?: boolean; className?: string }) {
  const cv = useRef<HTMLCanvasElement>(null)
  const mx = useSpring(useMotionValue(0.5), { stiffness: 140, damping: 16 })
  const my = useSpring(useMotionValue(0.5), { stiffness: 140, damping: 16 })
  const rx = useTransform(my, [0, 1], [10, -10])
  const ry = useTransform(mx, [0, 1], [-14, 14])
  const shine = useTransform([mx, my], ([x, y]) => `radial-gradient(circle at ${(x as number) * 100}% ${(y as number) * 100}%, rgba(255,255,255,.38), transparent 45%)`)

  useEffect(() => {
    let off = false
    loadFonts().then(() => { if (!off && cv.current) drawTicket(cv.current, cat, opts) })
    return () => { off = true }
  }, [cat, opts?.name, opts?.number, opts?.qr])

  return (
    <motion.div
      className={`tv ${className}`}
      style={tilt ? { rotateX: rx, rotateY: ry, transformPerspective: 900 } : undefined}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        mx.set((e.clientX - r.left) / r.width); my.set((e.clientY - r.top) / r.height)
      }}
      onPointerLeave={() => { mx.set(0.5); my.set(0.5) }}
    >
      <canvas ref={cv} aria-label={`Billet ${cat.name}`} />
      {tilt && <motion.i className="tv-shine" style={{ background: shine }} />}
    </motion.div>
  )
}
