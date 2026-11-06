import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { CATEGORIES, CatId, fcfa } from './data'
import Background from './Background'
import { drawTicket, loadFonts, TW, TH } from './ticketArt'

/* Ruban de billets : adaptation du "Video Ribbon" (scroll p 0→1 pilote tout).
   Les 8 cartes du ruban reprennent les 4 catégories deux fois ; les 4 premières atterrissent en grille. */

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x))
const mix = (a: number, b: number, t: number) => a + (b - a) * t
const ease = (t: number) => t * t * (3 - 2 * t)
const out = (t: number) => 1 - (1 - t) ** 3
const span = (p: number, a: number, b: number) => clamp((p - a) / (b - a))

const CARD_W = 2.1, CARD_H = (CARD_W * TH) / TW, STEP = CARD_W + 0.05, NX = 28, NY = 3
const RIB_A = 0.14, RIB_B = 0.63, GZ = 8, FOV = 35

const VS = `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`
const FS = `uniform sampler2D map;uniform float aspect,ready,radius,time,seed;varying vec2 vUv;
void main(){
  vec2 q=(abs(vUv-.5)-.5)*vec2(aspect,1.)+radius;
  float d=length(max(q,0.))+min(max(q.x,q.y),0.)-radius;
  float px=fwidth(d),a=1.-smoothstep(-px,px,d);
  if(a<.01)discard;
  vec2 uv=vUv;if(!gl_FrontFacing)uv.x=1.-uv.x;
  vec4 t=texture2D(map,uv);
  vec3 c=mix(vec3(.12,.08,.29),t.rgb,ready);
  // reflet qui balaie le billet
  float s=fract(time*.16+seed);
  float band=smoothstep(.09,0.,abs(uv.x*.8+uv.y*.35-(s*1.9-.4)));
  c+=band*.2*t.a;
  gl_FragColor=vec4(c,a*t.a);
}`

interface Props {
  onPick: (id: CatId) => void
  children?: React.ReactNode
}

export default function Ribbon({ onPick, children }: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const l1 = useRef<HTMLDivElement>(null)
  const l2 = useRef<HTMLDivElement>(null)
  const cap = useRef<HTMLDivElement>(null)
  const intro = useRef<HTMLDivElement>(null)
  const rule = useRef<HTMLDivElement>(null)
  const pill = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const labels = useRef<(HTMLDivElement | null)[]>([])
  const paths = useRef<(SVGPathElement | null)[]>([])
  const dots = useRef<(SVGCircleElement | null)[]>([])
  const pick = useRef(onPick)
  pick.current = onPick

  useEffect(() => {
    const canvas = canvasRef.current!
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    renderer.setClearColor(0, 0)
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100)

    /* rail */
    let PATH_L = 1
    const SAMPLES = 1200
    const pathP: THREE.Vector3[] = [], pathT: THREE.Vector3[] = []
    const PH0 = -1.5, PH1 = Math.PI * 2 + 1.35
    {
      const pts: THREE.Vector3[] = []
      for (let i = 0; i <= 160; i++) {
        const t = i / 160, ph = mix(PH0, PH1, t), cs = Math.cos(ph), u = 2 * t - 1
        const depth = cs > 0 ? 7.6 + 16.4 * cs ** 0.9 : 7.6 + 2.2 * cs
        const edge = 0.84 + 0.5 * span(0.14 - t, 0, 0.14) + 0.8 * span(t, 0.84, 1)
        pts.push(new THREE.Vector3(edge * Math.sin(ph) * depth * 0.561, 0.5 * Math.sign(u) * Math.abs(u) ** 1.4 * depth * 0.63, -depth))
      }
      const path = new THREE.CatmullRomCurve3(pts, false, 'centripetal')
      path.arcLengthDivisions = 1500
      PATH_L = path.getLength()
      for (let i = 0; i <= SAMPLES; i++) { pathP.push(path.getPointAt(i / SAMPLES)); pathT.push(path.getTangentAt(i / SAMPLES)) }
    }
    const at = (s: number, op: THREE.Vector3, ot: THREE.Vector3) => {
      const f = clamp(s / PATH_L) * SAMPLES, i = Math.min(SAMPLES - 1, Math.floor(f)), k = f - i
      op.lerpVectors(pathP[i], pathP[i + 1], k)
      ot.lerpVectors(pathT[i], pathT[i + 1], k).normalize()
    }

    /* cartes */
    interface Card { i: number; cat: (typeof CATEGORIES)[number]; geo: THREE.PlaneGeometry; mat: THREE.ShaderMaterial; mesh: THREE.Mesh; rect: any }
    const cards: Card[] = []
    const mkCards = async () => {
      await loadFonts()
      if (disposed) return
      const texs = CATEGORIES.map((cat) => {
        const cv = document.createElement('canvas')
        drawTicket(cv, cat)
        const tex = new THREE.CanvasTexture(cv)
        tex.colorSpace = THREE.NoColorSpace
        tex.anisotropy = 8
        return tex
      })
      for (let i = 0; i < 8; i++) {
        const cat = CATEGORIES[i % 4]
        const geo = new THREE.PlaneGeometry(1, 1, NX, NY)
        const mat = new THREE.ShaderMaterial({
          vertexShader: VS, fragmentShader: FS, transparent: true, side: THREE.DoubleSide,
          uniforms: { map: { value: texs[i % 4] }, aspect: { value: TW / TH }, ready: { value: 1 }, radius: { value: 0.02 }, time: { value: 0 }, seed: { value: (i % 4) * 0.23 } },
        })
        const mesh = new THREE.Mesh(geo, mat)
        mesh.frustumCulled = false
        scene.add(mesh)
        cards.push({ i, cat, geo, mat, mesh, rect: null })
      }
    }
    let disposed = false
    mkCards()

    /* mise en page */
    let W = 1, H = 1, asp = 1, cols = 2, rows = 2, tanH = 0.3153
    let runA = -22, runB = 76, riseV = 34
    const resize = () => {
      W = innerWidth; H = innerHeight; asp = W / H
      // Titre : départ visible en entier sur mobile, sortie complète quel que soit l'écran
      const tw = Math.max(l1.current?.firstElementChild?.getBoundingClientRect().width ?? 0, l2.current?.firstElementChild?.getBoundingClientRect().width ?? 0)
      runA = asp < 1 ? 0 : -14
      riseV = H < 600 ? 12 : 34 // écrans bas (téléphone en paysage) : le titre reste dans le cadre
      runB = Math.max(76, 62 + (tw / 2 / W) * 100)
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(W, H, false)
      camera.aspect = asp
      const fa = Math.max(asp, 0.78) // portrait : billets plus grands, le ruban déborde un peu de l'écran
      camera.fov = fa < 16 / 9 ? (Math.atan(0.561 / fa) * 360) / Math.PI : FOV
      camera.updateProjectionMatrix()
      tanH = Math.tan((camera.fov * Math.PI) / 360)
      cols = asp < 0.9 ? 1 : 2; rows = 4 / cols
    }
    addEventListener('resize', resize); resize()
    const grid = (i: number) => {
      const vh = 2 * GZ * tanH, vw = vh * asp
      // 1 colonne (mobile) : la pile de 4 billets doit tenir sous la navbar (≈ 76 % de la hauteur) et rester à l'écart des bords
      const gw = cols === 2 ? vw * 0.62 : Math.min(vw * 0.8, vh * 0.355), gap = gw * 0.025
      const cw = (gw - gap * (cols - 1)) / cols, ch = cw / (TW / TH)
      const rg = gap * 3.4, gh = ch * rows + rg * (rows - 1)
      const c = i % cols, r = Math.floor(i / cols)
      return { x: -gw / 2 + cw / 2 + c * (cw + gap), y: gh / 2 - ch / 2 - r * (ch + rg) - vh * 0.05, w: cw, h: ch, vw, vh, c, r }
    }

    let target = 0, p = 0
    const readScroll = () => { const t = trackRef.current!; target = clamp(scrollY / ((t.offsetHeight - innerHeight) / 0.86)) }
    addEventListener('scroll', readScroll, { passive: true }); readScroll()

    const op = new THREE.Vector3(), ot = new THREE.Vector3(), up = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), vp = new THREE.Vector3()
    const poseRibbon = (c: Card, head: number) => {
      const pos = c.geo.attributes.position, centre = head - c.i * STEP
      for (let iy = 0; iy <= NY; iy++) for (let ix = 0; ix <= NX; ix++) {
        const lu = ix / NX - 0.5, lv = 0.5 - iy / NY
        at(centre + lu * CARD_W, op, ot)
        up.copy(Y).addScaledVector(ot, -Y.dot(ot)).normalize()
        vp.copy(op).addScaledVector(up, lv * CARD_H)
        pos.setXYZ(iy * (NX + 1) + ix, vp.x, vp.y, vp.z)
      }
      pos.needsUpdate = true
    }
    const poseGrid = (c: Card, q: number) => {
      const g = grid(c.i), pos = c.geo.attributes.position
      const dx = (g.c - (cols - 1) / 2) * 1.2, dy = g.r < rows / 2 ? 1 : -1
      const ox = dx * g.vw * 0.55 * (1 - q), oy = dy * g.vh * 0.5 * (1 - q), tilt = (1 - q) * 0.22 * (g.c - 0.5) * dy
      const cs = Math.cos(tilt), sn = Math.sin(tilt)
      for (let iy = 0; iy <= NY; iy++) for (let ix = 0; ix <= NX; ix++) {
        const x = (ix / NX - 0.5) * g.w, y = (0.5 - iy / NY) * g.h
        pos.setXYZ(iy * (NX + 1) + ix, g.x + ox + x * cs - y * sn, g.y + oy + x * sn + y * cs, -GZ - (1 - q) * 0.6 * Math.sin((ix / NX) * Math.PI))
      }
      pos.needsUpdate = true
      c.rect = { ...g, q }
    }

    const render = (time: number) => {
      const pp = p
      const rise = 1 - out(span(pp, 0, 0.12)), run = mix(runA, runB, span(pp, 0, 0.58))
      if (l1.current) l1.current.style.transform = `translate3d(${run}vw,${rise * riseV}vh,0)`
      if (l2.current) l2.current.style.transform = `translate3d(${-run}vw,${rise * riseV}vh,0)`
      if (cap.current) {
        cap.current.style.opacity = String(1 - span(pp, 0.52, 0.57))
        cap.current.style.transform = `translate(-50%,calc(-50% + ${rise * riseV}vh))`
      }
      if (intro.current) intro.current.style.opacity = String(1 - span(pp, 0, 0.05))
      if (rule.current) rule.current.style.transform = `scaleX(${ease(span(pp, 0.72, 0.86))})`
      const pr = span(pp, RIB_A, RIB_B), total = PATH_L + cards.length * STEP, head = mix(0, total, pr)
      for (const c of cards) {
        c.mat.uniforms.time.value = time
        const s = head - c.i * STEP, end = PATH_L - CARD_W
        if (s < end) {
          c.mesh.visible = s > CARD_W; c.rect = null
          if (c.mesh.visible) poseRibbon(c, head)
        } else if (c.i < 4) {
          const st = mix(RIB_A, RIB_B, (end + c.i * STEP) / total), q = out(span(pp, st, st + 0.13))
          c.mesh.visible = q > 0.001
          if (c.mesh.visible) poseGrid(c, q)
        } else { c.mesh.visible = false; c.rect = null }
      }
      // traits pointillés ondulés + labels (le trait part du billet vers l'extérieur)
      for (const c of cards) {
        if (c.i >= 4) continue
        const el = labels.current[c.i], pa = paths.current[c.i], dt = dots.current[c.i]
        if (!el || !pa || !dt) continue
        const g = c.rect
        if (!g || cols === 1) { el.style.opacity = '0'; pa.setAttribute('d', ''); dt.setAttribute('r', '0'); continue }
        const k = clamp((g.q - 0.55) / 0.45)
        const cw = (g.w / g.vw) * W, cx = (g.x / g.vw + 0.5) * W, cy = (0.5 - g.y / g.vh) * H
        const dir = g.c === 0 ? -1 : 1, up = g.r === 0 ? -1 : 1
        const x0 = cx + dir * (cw / 2 - 2), y0 = cy
        const margin = dir < 0 ? x0 : W - x0
        const len = clamp(margin - 200, 40, 120)
        const x3 = x0 + dir * len, y3 = y0 + up * H * 0.04
        const x1 = x0 + dir * len * 0.45, y1 = y0 - up * H * 0.03
        const x2 = x3 - dir * len * 0.35, y2 = y3 + up * H * 0.035
        const N = 46, last = Math.max(2, Math.round(N * k))
        let d = ''
        let px = x0, py = y0
        for (let n = 0; n <= last; n++) {
          const t = n / N, u = 1 - t
          px = u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3
          py = u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3
          // légère déformation façon trait à la main
          py += Math.sin(t * 17 + c.i * 2) * 1.4 * Math.sin(t * Math.PI)
          d += (n ? 'L' : 'M') + px.toFixed(1) + ' ' + py.toFixed(1)
        }
        pa.setAttribute('d', d)
        pa.style.opacity = String(k > 0 ? 1 : 0)
        dt.setAttribute('cx', px.toFixed(1)); dt.setAttribute('cy', py.toFixed(1)); dt.setAttribute('r', k > 0.97 ? '3.5' : '0')
        el.style.opacity = String(clamp((k - 0.8) / 0.2))
        el.style.transform = `translate(${x3 + dir * 12}px,${y3}px) translate(${dir < 0 ? '-100%' : '0'},-50%)`
      }
      renderer.render(scene, camera)
    }

    /* survol + clic */
    const hitAt = (x: number, y: number) => {
      if (p < 0.86) return null
      const nx = x / W - 0.5, ny = 0.5 - y / H
      let hit: Card | null = null
      for (const c of cards) {
        const g = c.rect; if (!g) continue
        if (Math.abs(nx * g.vw - g.x) < g.w / 2 && Math.abs(ny * g.vh - g.y) < g.h / 2) hit = c
      }
      return hit
    }
    const st = stage.current!
    const onMove = (e: PointerEvent) => {
      const hit = hitAt(e.clientX, e.clientY), el = pill.current!
      st.style.cursor = hit ? 'pointer' : 'default'
      el.style.opacity = hit ? '1' : '0'
      if (hit) {
        el.textContent = `${hit.cat.name} · ${fcfa(hit.cat.price)} — choisir`
        el.style.transform = `translate(${e.clientX + 14}px,${e.clientY + 16}px)`
      }
    }
    const onClick = (e: MouseEvent) => { const hit = hitAt(e.clientX, e.clientY); if (hit) pick.current(hit.cat.id) }
    st.addEventListener('pointermove', onMove)
    st.addEventListener('click', onClick)

    let raf = 0
    const t0 = performance.now()
    const loop = () => {
      p += (target - p) * 0.05
      if (Math.abs(target - p) < 0.00005) p = target
      render((performance.now() - t0) / 1000)
      raf = requestAnimationFrame(loop)
    }
    loop()

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      removeEventListener('resize', resize); removeEventListener('scroll', readScroll)
      st.removeEventListener('pointermove', onMove); st.removeEventListener('click', onClick)
      cards.forEach((c) => { c.geo.dispose(); c.mat.dispose() })
      renderer.dispose()
    }
  }, [])

  return (
    <div id="track" ref={trackRef}>
      <section className="stage" ref={stage} aria-label="Les billets du WTM Gala">
        <h1 className="sr" >Le WTM Gala, samedi 12 décembre 2026</h1>
        <Background />
        <div className="hl" id="l1" ref={l1} aria-hidden="true"><span>Le WTM</span></div>
        <div className="hl" id="l2" ref={l2} aria-hidden="true"><span><i className="gala">Gala</i> 2026</span></div>
        <div id="cap" ref={cap}>Samedi 12 décembre · Prenez votre place</div>
        <div ref={intro}>
          <div id="glow" />
          <div id="cross"><i>+</i></div>
          <div id="scrollhint">Faites défiler ↓</div>
        </div>
        <div id="rule" ref={rule} />
        <canvas id="gl" ref={canvasRef} />
        <svg className="callouts" aria-hidden="true">
          {CATEGORIES.map((c, i) => (
            <g key={c.id}><path ref={(el) => { paths.current[i] = el }} /><circle r="3.5" ref={(el) => { dots.current[i] = el }} /></g>
          ))}
        </svg>
        {CATEGORIES.map((c, i) => (
          <div key={c.id} className="cl-label" ref={(el) => { labels.current[i] = el }}>{c.name}</div>
        ))}
        <div id="pill" ref={pill} />
        {children}
      </section>
    </div>
  )
}
