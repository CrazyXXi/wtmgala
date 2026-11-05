import QRCode from 'qrcode'
import { NAVY, LIME, Category, EVENT } from './data'

// Silhouette provisoire (à remplacer par le visuel officiel du Gala).
export const SIL_PATH =
  'M47 22 C46 30 40 34 41 44 C42 54 46 60 44 72 C40 100 30 150 18 206 C32 190 41 197 48 216 C53 196 61 180 67 160 C73 135 62 100 58 76 C56 62 60 54 60 44 C60 34 54 30 53 22 Z'
const SIL_HEAD = { x: 50, y: 12, r: 8.5 }

export const TW = 1600
export const TH = 750

function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath()
  c.roundRect(x, y, w, h, r)
}

function waves(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, alpha: number) {
  c.save()
  rr(c, x, y, w, h, 34)
  c.clip()
  c.strokeStyle = color
  c.lineWidth = 3
  const cx = x + w * 0.78, cy = y + h * 1.25
  for (let r = 40; r < w * 1.4; r += 17) {
    c.globalAlpha = alpha * (0.5 + 0.5 * Math.sin(r * 0.03))
    c.beginPath()
    c.arc(cx, cy, r, 0, Math.PI * 2)
    c.stroke()
  }
  // grain léger
  c.globalAlpha = 0.06
  for (let i = 0; i < 2200; i++) {
    c.fillStyle = Math.random() > 0.5 ? '#fff' : NAVY
    c.fillRect(x + Math.random() * w, y + Math.random() * h, 2, 2)
  }
  c.restore()
}

export function drawQR(c: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fg: string, bg: string) {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' })
  const n = qr.modules.size
  const cell = size / (n + 4)
  c.fillStyle = bg
  rr(c, x, y, size, size, 14)
  c.fill()
  c.fillStyle = fg
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++)
      if (qr.modules.data[j * n + i]) c.fillRect(x + (i + 2) * cell, y + (j + 2) * cell, cell + 0.4, cell + 0.4)
}

export interface TicketOpts {
  name?: string
  number?: string
  qr?: string
}

export function drawTicket(canvas: HTMLCanvasElement, cat: Category, o: TicketOpts = {}) {
  canvas.width = TW
  canvas.height = TH
  const c = canvas.getContext('2d')!
  c.clearRect(0, 0, TW, TH)
  const SPLIT = 1180

  // Corps blanc
  c.fillStyle = '#fff'
  rr(c, 0, 0, TW, TH, 44)
  c.fill()
  // encoches
  c.globalCompositeOperation = 'destination-out'
  for (const [cx, cy] of [[0, TH / 2], [TW, TH / 2]]) {
    c.beginPath(); c.arc(cx, cy, 44, 0, Math.PI * 2); c.fill()
  }
  c.globalCompositeOperation = 'source-over'

  // Panneau principal
  c.fillStyle = cat.main
  rr(c, 40, 40, SPLIT - 60, TH - 80, 34)
  c.fill()
  const wcol = cat.main === NAVY ? '#A7D3F0' : NAVY
  waves(c, 40, 40, SPLIT - 60, TH - 80, wcol, cat.main === NAVY ? 0.32 : 0.2)

  // Date
  c.fillStyle = cat.onMain
  c.textAlign = 'right'
  c.font = '400 54px "Instrument Sans"'
  c.fillText('12', SPLIT - 50, 130)
  c.fillText('Déc', SPLIT - 50, 188)
  c.font = '700 54px "Instrument Sans"'
  c.fillText('2026', SPLIT - 50, 246)

  // Silhouette
  c.save()
  const s = 3.1
  c.translate(SPLIT - 400, 70)
  c.scale(s, s)
  c.fillStyle = '#120a33'
  c.fill(new Path2D(SIL_PATH))
  c.beginPath(); c.arc(SIL_HEAD.x, SIL_HEAD.y, SIL_HEAD.r, 0, Math.PI * 2); c.fill()
  c.strokeStyle = cat.onMain; c.lineWidth = 0.7
  c.beginPath(); c.moveTo(36, 60); c.bezierCurveTo(14, 40, 18, 10, 30, -2); c.stroke()
  c.restore()

  // Titre
  c.textAlign = 'left'
  c.fillStyle = cat.onMain
  c.font = '500 72px "Instrument Sans"'
  c.fillText('Le', 110, 330)
  c.font = '400 210px "Instrument Sans"'
  c.letterSpacing = '-8px'
  c.fillText('WTM', 215, 345)
  c.font = '700 330px "Instrument Sans"'
  c.letterSpacing = '-18px'
  c.fillText('Gala', 90, 600)
  c.letterSpacing = '0px'

  // Pied
  c.font = '600 28px "Instrument Sans"'
  c.fillText(o.name ? o.name.toUpperCase() : 'BILLET PERSONNEL', 100, TH - 70)
  c.textAlign = 'right'
  c.font = '500 26px "Instrument Sans"'
  c.fillText(o.number ?? 'N° WTMG-2026-000123', SPLIT - 50, TH - 70)

  // Pointillés
  c.save()
  c.setLineDash([12, 10])
  c.strokeStyle = NAVY
  c.lineWidth = 3
  c.beginPath(); c.moveTo(SPLIT + 25, 40); c.lineTo(SPLIT + 25, TH - 40); c.stroke()
  c.restore()

  // Souche
  const sx = SPLIT + 50, sw = TW - 40 - sx
  c.fillStyle = cat.stub
  rr(c, sx, 40, sw, TH - 80, 34)
  c.fill()
  c.save()
  c.translate(sx + 56, 78)
  c.rotate(Math.PI / 2)
  c.fillStyle = cat.onStub
  c.font = '700 34px "Instrument Sans"'
  c.letterSpacing = '14px'
  c.textAlign = 'left'
  c.fillText(cat.name.toUpperCase(), 0, 0)
  c.restore()
  const qrSize = 190
  drawQR(c, o.qr ?? `WTMG|${cat.id}|demo`, sx + sw - qrSize - 30, 70, qrSize, NAVY, '#fff')
  c.fillStyle = cat.onStub
  c.textAlign = 'center'
  c.font = '700 205px "Instrument Sans"'
  c.letterSpacing = '-10px'
  c.fillText(cat.short, sx + sw / 2 + 4, TH - 90)
  c.letterSpacing = '0px'
  void LIME; void EVENT
  return canvas
}

export async function loadFonts() {
  await Promise.all([
    document.fonts.load('400 100px "Instrument Sans"'),
    document.fonts.load('500 100px "Instrument Sans"'),
    document.fonts.load('600 100px "Instrument Sans"'),
    document.fonts.load('700 100px "Instrument Sans"'),
  ])
  await document.fonts.ready
}
