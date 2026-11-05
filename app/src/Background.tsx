import { useEffect, useRef } from 'react'

/* Fond animé inspiré de la référence : dégradé bleu ciel pointillé (grain) + anneaux concentriques qui respirent.
   Couleurs dérivées du Sky de la charte (#A7D3F0). Un seul canvas WebGL, sans bibliothèque. */

const VS = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`
const FS = `precision highp float;
uniform vec2 res;uniform float t;
float h(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y);}
float fbm(vec2 p){return .55*n(p)+.3*n(p*2.03+7.)+.15*n(p*4.1+3.);}
void main(){
  vec2 uv=gl_FragCoord.xy/res;
  float asp=res.x/res.y;
  vec2 q=vec2(uv.x*asp,uv.y);
  // zones plus sombres qui dérivent lentement
  float b=fbm(q*1.1+vec2(t*.02,-t*.015));
  float tone=.74+.45*(b-.45);
  // anneaux concentriques : deux centres qui flottent
  vec2 c1=vec2(asp*(.45+.08*sin(t*.07)),-.05+.06*cos(t*.09));
  vec2 c2=vec2(asp*(.85+.06*cos(t*.05)),.55+.05*sin(t*.06));
  float r1=length(q-c1),r2=length(q-c2);
  float w1=sin(r1*95.-t*.9),w2=sin(r2*80.+t*.7);
  float mask1=smoothstep(.2,.7,fbm(q*.8+3.))*smoothstep(1.6,.2,r1);
  float mask2=smoothstep(.35,.8,fbm(q*.7+11.))*smoothstep(1.3,.2,r2);
  float rings=w1*.5*mask1+w2*.4*mask2;
  tone+=rings*.2;
  // pointillé : le grain décide si le pixel est clair ou foncé
  float g=h(floor(gl_FragCoord.xy)+floor(t*6.)*.0);
  float v=smoothstep(.0,.9,clamp(tone+(g-.5)*.4,0.,1.));
  vec3 deep=vec3(.52,.79,.95),light=vec3(.93,.975,1.);
  gl_FragColor=vec4(mix(deep,light,v),1.);
}`

export default function Background() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current!
    const gl = cv.getContext('webgl', { antialias: false, alpha: false })
    if (!gl) return
    const sh = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return s }
    const pr = gl.createProgram()!
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS))
    gl.linkProgram(pr); gl.useProgram(pr)
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    const uRes = gl.getUniformLocation(pr, 'res'), uT = gl.getUniformLocation(pr, 't')
    const resize = () => {
      const d = Math.min(devicePixelRatio, 1.5)
      cv.width = Math.floor(innerWidth * d); cv.height = Math.floor(innerHeight * d)
      gl.viewport(0, 0, cv.width, cv.height)
    }
    addEventListener('resize', resize); resize()
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    const t0 = performance.now()
    const draw = () => {
      gl.uniform2f(uRes, cv.width, cv.height)
      gl.uniform1f(uT, still ? 20 : (performance.now() - t0) / 1000 + 20)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      if (!still) raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', resize) }
  }, [])
  return <canvas ref={ref} className="bg" aria-hidden="true" />
}
