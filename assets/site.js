const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;
const mobile = () => innerWidth < 860;
const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/* ---------- Smooth scrolling ---------- */
let lenis;
if (!reduced) {
  import('lenis').then(({ default: Lenis }) => {
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    lenis.on('scroll', onScroll);
    (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(performance.now());
  }).catch(() => {});
}
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const el = document.querySelector(a.getAttribute('href'));
  if (!el) return;
  e.preventDefault();
  if (lenis) lenis.scrollTo(el, { offset: 0, duration: 1.4 });
  else el.scrollIntoView();
});

/* ---------- Nav ---------- */
const nav = document.getElementById('nav');
const menuBtn = nav.querySelector('.menu-btn');
const links = document.getElementById('links');
menuBtn.addEventListener('click', () => {
  const open = links.classList.toggle('open');
  menuBtn.setAttribute('aria-expanded', open);
});
links.addEventListener('click', e => { if (e.target.closest('a')) links.classList.remove('open'); });

/* ---------- Shorts player: hero card + dock share one <audio> ---------- */
// Real shorts from production, copied from api.audiovibe.co/preview/<id>.mp3.
const SHORTS = [
  { id: '62a879cd-305a-4a0f-ba60-6b4409218fcb', file: 'microwave', title: 'The Microwave Oven: The Melted Chocolate Bar', chan: 'Eureka Tales', handle: 'eurekatales' },
  { id: '7e597585-66ae-4a0f-8e03-d0f771a6edf7', file: 'bad-comment', title: 'Why You Remember the One Bad Comment', chan: 'Psyche Session', handle: 'psychesession' },
  { id: 'ad2ea80a-3221-4617-be29-d62ddffc6af6', file: 'uber', title: 'Uber: The Taxi Company With No Taxis', chan: 'Business Decoded', handle: 'businessdecoded' },
  { id: '1bb105de-2d55-44d8-9001-5f42f7a6bec1', file: 'maui', title: 'Maui Snares the Sun at Haleakala', chan: 'Mythic Archives', handle: 'mythicarchives' },
];
const audio = document.getElementById('sample');
const players = [document.getElementById('np'), document.getElementById('dock')];
const parts = name => players.flatMap(p => [...p.querySelectorAll(`[data-np="${name}"]`)]);
const dock = document.getElementById('dock');
const level = { amp: 0, low: 0, high: 0 };
let analyser, bins, track = 0, started = false, dockDismissed = false, heroVisible = true;

function load(i, play) {
  track = (i + SHORTS.length) % SHORTS.length;
  const s = SHORTS[track];
  audio.src = `assets/shorts/${s.file}.mp3`;
  parts('cover').forEach(el => { el.src = `assets/shorts/${s.file}.webp`; });
  parts('title').forEach(el => { el.textContent = s.title; });
  parts('chan').forEach(el => { el.textContent = s.chan; });
  parts('link').forEach(el => { el.href = `https://api.audiovibe.co/@${s.handle}/audio/${s.id}`; });
  if (play) start();
}
function ensureAnalyser() {
  if (analyser) return;
  try {
    const ctx = new AudioContext();
    analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.75;
    bins = new Uint8Array(analyser.frequencyBinCount);
    ctx.createMediaElementSource(audio).connect(analyser).connect(ctx.destination);
  } catch { /* plays without the visuals reacting */ }
}
async function start() {
  ensureAnalyser();
  started = true; dockDismissed = false;
  try { await audio.play(); } catch { /* blocked autoplay: the button stays on play */ }
}
function sync() {
  const on = !audio.paused;
  players.forEach(p => p.classList.toggle('playing', on));
  parts('toggle').forEach(b => b.setAttribute('aria-label', on ? 'Pause' : 'Play'));
  updateDock();
}
function updateDock() {
  const show = started && !dockDismissed && !heroVisible;
  dock.classList.toggle('show', show);
  document.body.classList.toggle('docked', show);
}
parts('toggle').forEach(b => b.addEventListener('click', () => (audio.paused ? start() : audio.pause())));
parts('next').forEach(b => b.addEventListener('click', () => load(track + 1, true)));
document.getElementById('dock-close').addEventListener('click', () => { audio.pause(); dockDismissed = true; updateDock(); });
audio.addEventListener('play', sync);
audio.addEventListener('pause', sync);
audio.addEventListener('ended', () => load(track + 1, true)); // like the feed: the next one starts by itself
audio.addEventListener('loadedmetadata', () => parts('dur').forEach(el => { el.textContent = fmt(audio.duration); }));
audio.addEventListener('timeupdate', () => {
  const p = audio.duration ? audio.currentTime / audio.duration : 0;
  parts('fill').forEach(el => { el.style.width = `${p * 100}%`; });
  parts('cur').forEach(el => { el.textContent = fmt(audio.currentTime); });
  parts('seek').forEach(el => el.setAttribute('aria-valuenow', Math.round(p * 100)));
});
parts('seek').forEach(el => {
  el.addEventListener('click', e => {
    const r = el.getBoundingClientRect();
    if (audio.duration) audio.currentTime = clamp((e.clientX - r.left) / r.width) * audio.duration;
  });
  el.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') audio.currentTime += 10;
    if (e.key === 'ArrowLeft') audio.currentTime -= 10;
  });
});
load(0, false);

const barsEl = document.getElementById('bars');
const barSpans = Array.from({ length: 18 }, () => barsEl.appendChild(document.createElement('span')));
function readLevel() {
  let amp = 0, low = 0, high = 0;
  if (analyser && !audio.paused) {
    analyser.getByteFrequencyData(bins);
    for (let i = 0; i < 64; i++) amp += bins[i];
    for (let i = 1; i < 8; i++) low += bins[i];
    for (let i = 16; i < 56; i++) high += bins[i];
    amp /= 64 * 255; low /= 7 * 255; high /= 40 * 255;
    if (dock.classList.contains('show')) {
      barSpans.forEach((s, i) => { s.style.transform = `scaleY(${(0.15 + (bins[2 + i * 3] / 255) * 0.85).toFixed(2)})`; });
    }
  }
  level.amp = lerp(level.amp, amp, 0.25);
  level.low = lerp(level.low, low, 0.25);
  level.high = lerp(level.high, high, 0.25);
}
(function levelLoop() { readLevel(); requestAnimationFrame(levelLoop); })();

/* ---------- The voice sphere (hero only) ---------- */
const NOISE = `
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857;vec3 ns=n_*D.wyz-D.xzx;vec4 j=p-49.*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));}`;

const hero = document.querySelector('.hero');
async function startVoice() {
  const canvas = document.getElementById('voice');
  let THREE, renderer;
  try {
    THREE = await import('three');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true });
  } catch { document.documentElement.classList.add('no-webgl'); return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 50);
  camera.position.z = 4.2;
  const group = new THREE.Group();
  scene.add(group);

  // Points spread evenly over a sphere (Fibonacci lattice).
  const N = mobile() ? 7000 : 14000;
  const pos = new Float32Array(N * 3), rnd = new Float32Array(N);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), t = golden * i;
    pos.set([Math.cos(t) * r, y, Math.sin(t) * r], i * 3);
    rnd[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aRand', new THREE.BufferAttribute(rnd, 1));

  const uniforms = {
    uTime: { value: 0 }, uAmp: { value: 0 }, uLow: { value: 0 }, uHigh: { value: 0 },
    uPx: { value: renderer.getPixelRatio() }, uOpacity: { value: 0 },
    uA: { value: new THREE.Color('#22d3ee') }, uB: { value: new THREE.Color('#1f74ec') },
  };
  group.add(new THREE.Points(geo, new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `${NOISE}
      uniform float uTime, uAmp, uLow, uHigh, uPx;
      attribute float aRand;
      varying float vDisp, vY, vFront;
      void main() {
        vec3 p = position;
        float n = snoise(p * 1.4 + vec3(uTime * .22));
        float n2 = snoise(p * 3.6 - vec3(uTime * .35));
        float d = n * .14 + n2 * .05 * (.4 + uHigh * 4.) + uLow * .22 * (.55 + .45 * n);
        d += uAmp * .14 * sin(p.y * 14. - uTime * 7.);
        vec3 q = p * (1. + d);
        vDisp = d; vY = p.y;
        vFront = normalize(mat3(modelViewMatrix) * p).z;
        vec4 mv = modelViewMatrix * vec4(q, 1.);
        gl_PointSize = (2.4 + aRand * 2.6 + uAmp * 3.) * uPx * (3.4 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uA, uB; uniform float uOpacity, uAmp;
      varying float vDisp, vY, vFront;
      void main() {
        float r = length(gl_PointCoord - .5);
        if (r > .5) discard;
        vec3 c = mix(uA, uB, clamp(.5 - vY * .5 + vDisp * 1.5, 0., 1.));
        c += vec3(.35, .6, 1.) * clamp(vDisp * 2.5, 0., 1.) * (.4 + uAmp);
        float a = smoothstep(.5, .1, r) * (.22 + .78 * smoothstep(-.6, 1., vFront));
        gl_FragColor = vec4(c * 1.15, a * uOpacity);
      }`,
  })));

  const halo = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `uniform vec3 uB; uniform float uOpacity, uAmp; varying vec2 vUv;
      void main(){ float d = length(vUv - .5); gl_FragColor = vec4(uB, smoothstep(.5, 0., d) * (.28 + uAmp * .4) * uOpacity); }`,
  }));
  scene.add(halo);

  function place() {
    const w = hero.clientWidth, h = hero.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const halfH = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z;
    const halfW = halfH * camera.aspect;
    // Desktop: upper right, clear of the headline. Phone: above the headline.
    const [x, y, s] = mobile() ? [0, halfH * 0.55, 0.62] : [halfW * 0.46, halfH * 0.2, 1.2];
    group.position.set(x, y, 0); halo.position.set(x, y, -1.2);
    group.userData.s = s;
  }
  addEventListener('resize', place);
  place();

  const mouse = { x: 0, y: 0 };
  addEventListener('pointermove', e => { mouse.x = e.clientX / innerWidth - 0.5; mouse.y = e.clientY / innerHeight - 0.5; });

  const clock = new THREE.Clock();
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    uniforms.uTime.value += dt * (reduced ? 0.25 : 1);
    uniforms.uAmp.value = level.amp; uniforms.uLow.value = level.low; uniforms.uHigh.value = level.high;
    uniforms.uOpacity.value = lerp(uniforms.uOpacity.value, 1, 0.03);
    const s = group.userData.s * (1 + level.low * 0.05);
    group.scale.setScalar(s); halo.scale.setScalar(s);
    if (!reduced) {
      group.rotation.y = lerp(group.rotation.y, uniforms.uTime.value * 0.06 + mouse.x * 0.6, 0.05);
      group.rotation.x = lerp(group.rotation.x, mouse.y * 0.4, 0.05);
    }
    renderer.render(scene, camera);
  }
  // Only draw while the hero is on screen.
  new IntersectionObserver(([e]) => renderer.setAnimationLoop(e.isIntersecting ? frame : null)).observe(hero);
}
startVoice();
new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; updateDock(); }, { threshold: 0.15 }).observe(hero);

/* ---------- Press play, keep moving: a self-moving strip ---------- */
// Moves on its own like a billboard. Scrolling past it never stops; a scroll
// only gives it a brief push in the same direction.
{
  const day = document.getElementById('day');
  const dayTrack = document.getElementById('day-track');
  const toggle = document.getElementById('day-toggle');
  [...dayTrack.children].forEach(m => {
    const c = m.cloneNode(true);
    c.setAttribute('aria-hidden', 'true');
    dayTrack.appendChild(c);
  });
  let x = 0, speed = 0, paused = false, slow = false, visible = false, running = false, last = 0, lastY = scrollY;
  const BASE = 42; // px per second
  dayTrack.addEventListener('pointerenter', () => { slow = true; });
  dayTrack.addEventListener('pointerleave', () => { slow = false; });
  toggle.addEventListener('click', () => {
    paused = !paused;
    toggle.textContent = paused ? 'Play' : 'Pause';
    toggle.setAttribute('aria-pressed', paused);
  });
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    day.classList.toggle('live', visible);
    if (visible && !reduced && !running) { running = true; last = performance.now(); lastY = scrollY; requestAnimationFrame(step); }
  }).observe(day);
  function step(now) {
    if (!visible) { running = false; return; }
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    const dy = scrollY - lastY; lastY = scrollY;
    const target = paused ? 0 : BASE * (slow ? 0.2 : 1) + Math.min(Math.abs(dy) * 30, 600);
    speed = lerp(speed, target, 0.08);
    const half = dayTrack.scrollWidth / 2;
    x = (x + speed * dt) % half;
    dayTrack.style.transform = `translate3d(${-x}px,0,0)`;
    requestAnimationFrame(step);
  }
}

/* ---------- A fan's waking day: dial ---------- */
// 07:00 at the top, 23:00 back round to it. Every slot is filled, so the
// comparison is honest: screen time alone, then screen time plus listening time.
{
  const NS = 'http://www.w3.org/2000/svg';
  const g = document.getElementById('dial-g');
  const dial = document.getElementById('dial');
  const num = document.getElementById('dial-num');
  const sub = document.getElementById('dial-sub');
  const C = 220, R = 150;
  const mk = (tag, attrs) => {
    const el = document.createElementNS(NS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    g.appendChild(el);
    return el;
  };
  // A 24-hour clock turned so the night (23:00 to 07:00) sits at the top.
  const deg = h => -90 + ((h - 3) / 24) * 360;
  const pt = (h, r) => {
    const a = (deg(h) * Math.PI) / 180;
    return [C + Math.cos(a) * r, C + Math.sin(a) * r];
  };
  const DAY = [
    [7, 8.5, 'ear', 'Morning commute'],
    [8.5, 10.5, 'ear', 'Focused work'],
    [10.5, 12.5, 'busy', 'Meetings'],
    [12.5, 13, 'ear', 'Lunch walk'],
    [13, 13.5, 'screen', 'Lunch scroll'],
    [13.5, 15.5, 'busy', 'Calls'],
    [15.5, 17.5, 'ear', 'Focused work'],
    [17.5, 18.5, 'ear', 'Commute home'],
    [18.5, 19.25, 'ear', 'Gym'],
    [19.25, 20, 'ear', 'Cooking'],
    [20, 21, 'busy', 'Dinner'],
    [21, 22.25, 'screen', 'Evening scroll'],
    [22.25, 23, 'ear', 'Winding down'],
  ];
  const GAP = 0.05; // hours of space between slots
  let earIndex = 0;
  DAY.forEach(([from, to, kind, label]) => {
    const [x1, y1] = pt(from + GAP, R), [x2, y2] = pt(to - GAP, R);
    const big = deg(to - GAP) - deg(from + GAP) > 180 ? 1 : 0;
    const seg = mk('path', { d: `M${x1} ${y1} A${R} ${R} 0 ${big} 1 ${x2} ${y2}`, class: `seg ${kind}`, pathLength: 1 });
    // listening slots light one after another, like the day filling up
    if (kind === 'ear') seg.style.transitionDelay = `0s, ${(earIndex++ * 0.12).toFixed(2)}s, ${((earIndex - 1) * 0.12).toFixed(2)}s`;
    const [x, y] = pt((from + to) / 2, R + 30);
    const anchor = x > C + 12 ? 'start' : x < C - 12 ? 'end' : 'middle';
    mk('text', { x, y: y + 4, 'text-anchor': anchor, class: `lbl ${kind}` }).textContent = label;
  });
  // Sleep: the fixed reference point, the same colour in every view.
  {
    const [x1, y1] = pt(23 + GAP, R), [x2, y2] = pt(31 - GAP, R);
    mk('path', { d: `M${x1} ${y1} A${R} ${R} 0 0 1 ${x2} ${y2}`, class: 'seg sleep', pathLength: 1 });
    const zz = mk('g', { class: 'zz', transform: `translate(${C - 11} ${C - R - 11}) scale(${22 / 24})` });
    zz.innerHTML = '<path d="M17 13.5A6.5 6.5 0 1 1 9.5 6a5 5 0 0 0 7.5 7.5z"/><path d="M15 4h4l-4 4h4"/>';
  }

  const hours = k => DAY.filter(d => k.includes(d[2])).reduce((n, d) => n + d[1] - d[0], 0);
  const fmtH = h => { const m = Math.round(h * 60); return m % 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m / 60}h`; };
  const buttons = [...document.querySelectorAll('.modes button')];
  let shown = hours(['screen']), raf;
  function setMode(mode, animate = true) {
    dial.classList.add('lit-screen');
    dial.classList.toggle('lit-ear', mode === 'ear');
    buttons.forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === mode));
    sub.textContent = mode === 'ear' ? 'with AudioVibe' : 'with video only';
    const target = hours(mode === 'ear' ? ['screen', 'ear'] : ['screen']);
    cancelAnimationFrame(raf);
    if (!animate || reduced) { shown = target; num.textContent = fmtH(shown); return; }
    const from = shown, t0 = performance.now();
    (function tick(now) {
      const k = clamp((now - t0) / 1200);
      shown = from + (target - from) * (1 - Math.pow(1 - k, 3));
      num.textContent = fmtH(Math.round(shown * 4) / 4);
      if (k < 1) raf = requestAnimationFrame(tick);
    })(t0);
  }
  buttons.forEach(b => b.addEventListener('click', () => { touched = true; setMode(b.dataset.mode); }));
  let touched = false;
  setMode('screen', false);
  new IntersectionObserver(([e], obs) => {
    if (!e.isIntersecting) return;
    obs.disconnect();
    dial.classList.add('in');
    // Show video alone first, then let the listening hours fill in.
    setTimeout(() => { if (!touched) setMode('ear'); }, reduced ? 0 : 2200);
  }, { threshold: 0.4 }).observe(dial);
}

/* ---------- Phone tour ---------- */
const phone = document.getElementById('phone');
const tilt = phone.parentElement;
const shot = document.getElementById('shot');
const tour = document.getElementById('tour');
const steps = [...tour.querySelectorAll('.step')];
steps.forEach(s => { new Image().src = `assets/shots/${s.dataset.shot}.webp`; });
let currentShot = 'for-you', spin, swapTimer;
const pointer = { x: 0, y: 0 };
let scrollTurn = 0;

// The two glass cards beside the phone change with each step.
const ICON = {
  auto: '<path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3"/><path d="M18 3v4h-4M6 21v-4h4"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  back: '<path d="M4 12a8 8 0 1 0 2.3-5.6L4 8.7"/><path d="M4 4v4.7h4.7"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  next: '<path d="M5 5l10 7-10 7zM19 5v14"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
  moon: '<path d="M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10z"/>',
  fade: '<path d="M4 18V14M9 18V10M14 18V7M19 18V4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
};
const FLOATS = {
  'for-you': [['auto', 'Autoscroll is on', 'The next one starts by itself'], ['heart', 'Learns what you finish', 'Not just what you tap']],
  'now-playing': [['back', 'Back 10 seconds', 'Missed a line? Tap once'], ['lock', 'Lock screen controls', 'No need to unlock']],
  'series-detail': [['next', 'Up next: Episode 3', 'Starts when this one ends'], ['bell', 'New episode out', 'From a series you follow']],
  'discover-rails': [['grid', 'Pick a category', 'Stories, news, science'], ['star', 'Featured', 'A fresh pick on Discover']],
  'sleep-timer': [['moon', 'Stops in 30:00', 'Or at the end of the episode'], ['fade', 'Fades out gently', 'No sudden silence']],
  'creator-profile': [['user', 'Following', 'Their new work comes first'], ['bell', 'New from Business Decoded', 'Uber: The Taxi Company With No Taxis']],
};
const floats = ['float-a', 'float-b'].map(id => document.getElementById(id));
function setFloats(name) {
  FLOATS[name].forEach(([icon, title, sub], i) => {
    const f = floats[i];
    f.querySelector('.fi').innerHTML = `<svg viewBox="0 0 24 24">${ICON[icon]}</svg>`;
    f.querySelector('b').textContent = title;
    f.querySelector(':scope > div > span').textContent = sub;
  });
}
setFloats('for-you');

function showShot(name) {
  if (name === currentShot) return;
  currentShot = name;
  floats.forEach(f => f.classList.add('out'));
  const swap = () => { shot.src = `assets/shots/${name}.webp`; setFloats(name); floats.forEach(f => f.classList.remove('out')); };
  if (reduced) return swap();
  spin?.cancel(); clearTimeout(swapTimer);
  spin = phone.animate([{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(360deg)' }],
    { duration: 1100, easing: 'cubic-bezier(.65,0,.35,1)' });
  swapTimer = setTimeout(swap, 550);
}
const io = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    steps.forEach(s => s.classList.toggle('on', s === e.target));
    showShot(e.target.dataset.shot);
  });
  // On phones the sticky phone covers the top half, so read the step from the lower part.
}, { rootMargin: matchMedia('(max-width: 860px) and (orientation: portrait)').matches ? '-72% 0px -22% 0px' : '-45% 0px -45% 0px' });
steps.forEach(s => io.observe(s));

function applyTilt() {
  tilt.style.transform = `rotateX(${-pointer.y * 16}deg) rotateY(${pointer.x * 26 + scrollTurn}deg)`;
}
if (!reduced) {
  addEventListener('pointermove', e => {
    const b = tilt.getBoundingClientRect();
    if (b.bottom < 0 || b.top > innerHeight) return;
    pointer.x = clamp((e.clientX - (b.left + b.width / 2)) / innerWidth, -0.5, 0.5);
    pointer.y = clamp((e.clientY - (b.top + b.height / 2)) / innerHeight, -0.5, 0.5);
    applyTilt();
  });
}

/* ---------- Scroll-driven bits ---------- */
function onScroll() {
  nav.classList.toggle('scrolled', scrollY > 40);
  if (reduced) return;
  const t = tour.getBoundingClientRect();
  scrollTurn = (clamp(-t.top / (t.height - innerHeight)) - 0.5) * -24;
  applyTilt();
}
addEventListener('scroll', onScroll, { passive: true });
addEventListener('resize', onScroll);

/* ---------- Originals ring ---------- */
const CHANNELS = [
  { id: 'global-thread', name: 'The Global Thread', handle: 'globalthread', about: "The day's world news, fast. Hosted by Eva." },
  { id: 'business-decoded', name: 'Business Decoded', handle: 'businessdecoded', about: 'How famous companies were really built, and the calls that made them. Hosted by Adrian.' },
  { id: 'eureka-tales', name: 'Eureka Tales', handle: 'eurekatales', about: 'The stories behind scientific discoveries. Hosted by Ethan.' },
  { id: 'root-health', name: 'The Root Health', handle: 'roothealth', about: 'What the evidence says about health, food and sleep. Hosted by Julia.' },
  { id: 'crime-files', name: 'The Crime Files', handle: 'crimefiles', about: 'True crime cases told from start to finish. Hosted by Daemon.' },
  { id: 'mythic-archives', name: 'Mythic Archives', handle: 'mythicarchives', about: 'Myths, legends and the history underneath them. Hosted by Akira.' },
  { id: 'psyche-session', name: 'Psyche Session', handle: 'psychesession', about: 'How the mind works, one idea at a time. Hosted by Sarah.' },
];
const ring = document.getElementById('ring');
const ringStage = document.getElementById('ring-stage');
const STEP = 360 / CHANNELS.length;
const cards = CHANNELS.map(c => {
  const a = document.createElement('a');
  a.className = 'chan';
  a.href = `https://api.audiovibe.co/@${c.handle}`;
  a.target = '_blank'; a.rel = 'noopener';
  a.tabIndex = -1;
  a.innerHTML = `<img src="assets/channels/${c.id}.webp" alt="" width="320" height="320" loading="lazy" draggable="false"><span class="ai">AI</span><span class="nm">${c.name}</span>`;
  ring.appendChild(a);
  return a;
});
ringStage.tabIndex = 0;
ringStage.setAttribute('role', 'group');
ringStage.setAttribute('aria-label', 'AudioVibe Originals channels');

let rot = 0, target = null, dragging = false, moved = 0, lastX = 0, hover = false, front = -1;
const info = { name: document.getElementById('chan-name'), about: document.getElementById('chan-about'), link: document.getElementById('chan-link') };
const frontIndex = () => ((Math.round(-rot / STEP) % CHANNELS.length) + CHANNELS.length) % CHANNELS.length;
const goTo = i => { target = -i * STEP + Math.round((rot + i * STEP) / 360) * 360; };

ringStage.addEventListener('pointerdown', e => { dragging = true; moved = 0; lastX = e.clientX; target = null; });
addEventListener('pointermove', e => {
  if (!dragging) return;
  const dx = e.clientX - lastX; lastX = e.clientX;
  moved += Math.abs(dx); rot += dx * 0.25;
});
addEventListener('pointerup', () => { if (dragging) { dragging = false; goTo(frontIndex()); } });
ringStage.addEventListener('pointerenter', () => { hover = true; });
ringStage.addEventListener('pointerleave', () => { hover = false; });
ringStage.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight') { goTo(frontIndex() + 1); e.preventDefault(); }
  if (e.key === 'ArrowLeft') { goTo(frontIndex() - 1); e.preventDefault(); }
  if (e.key === 'Enter') open(info.link.href, '_blank', 'noopener');
});
cards.forEach((c, i) => c.addEventListener('click', e => {
  // A drag is not a click, and a card that is not in front comes forward first.
  if (moved > 6 || i !== frontIndex()) { e.preventDefault(); if (moved <= 6) goTo(i); }
}));

let ringVisible = false;
new IntersectionObserver(([e]) => { ringVisible = e.isIntersecting; }).observe(ringStage);
(function ringLoop() {
  requestAnimationFrame(ringLoop);
  if (!ringVisible && front !== -1) return;
  if (target !== null) { rot = lerp(rot, target, reduced ? 1 : 0.1); if (Math.abs(rot - target) < 0.05) { rot = target; target = null; } }
  else if (!dragging && !hover && !reduced) rot -= 0.05;
  // Cards orbit the ring but always face the viewer.
  cards.forEach((c, i) => {
    const a = i * STEP + rot;
    const facing = Math.cos((a * Math.PI) / 180);
    c.style.transform = `rotateY(${a}deg) translateZ(var(--r)) rotateY(${-a}deg)`;
    c.style.opacity = (0.25 + 0.75 * clamp((facing + 0.4) / 1.4)).toFixed(3);
    c.style.filter = facing < 0.5 ? `blur(${((0.5 - facing) * 2).toFixed(1)}px)` : '';
  });
  const f = frontIndex();
  if (f !== front) {
    front = f;
    const c = CHANNELS[f];
    info.name.textContent = c.name;
    info.about.textContent = c.about;
    info.link.href = `https://api.audiovibe.co/@${c.handle}`;
    info.link.textContent = `Open @${c.handle}`;
  }
})();

onScroll();
