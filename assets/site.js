const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;
const mobile = () => innerWidth < 860;

/* ---------- Nav ---------- */
const nav = document.getElementById('nav');
const menuBtn = nav.querySelector('.menu-btn');
const links = document.getElementById('links');
menuBtn.addEventListener('click', () => {
  const open = links.classList.toggle('open');
  menuBtn.setAttribute('aria-expanded', open);
});
links.addEventListener('click', e => { if (e.target.closest('a')) links.classList.remove('open'); });

/* ---------- Sample audio + analyser ---------- */
const audio = document.getElementById('sample');
const sampleBtns = document.querySelectorAll('.sample-btn');
const note = document.querySelector('.sample-note');
const level = { amp: 0, low: 0, high: 0 };
let analyser, bins;

function setPlaying(on) {
  sampleBtns.forEach(b => {
    b.setAttribute('aria-pressed', on);
    b.querySelector('span').textContent = on ? 'Pause sample' : 'Hear a sample';
  });
  note.textContent = on ? "Alice's Adventures in Wonderland, chapter one, read by a LibriVox volunteer. Public domain." : '';
}
sampleBtns.forEach(b => b.addEventListener('click', async () => {
  if (!analyser) {
    try {
      const ctx = new AudioContext();
      analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.75;
      bins = new Uint8Array(analyser.frequencyBinCount);
      ctx.createMediaElementSource(audio).connect(analyser).connect(ctx.destination);
    } catch { /* plays without the sphere reacting */ }
  }
  if (audio.paused) { await audio.play(); setPlaying(true); } else { audio.pause(); setPlaying(false); }
}));
audio.addEventListener('ended', () => setPlaying(false));

function readLevel() {
  let amp = 0, low = 0, high = 0;
  if (analyser && !audio.paused) {
    analyser.getByteFrequencyData(bins);
    for (let i = 0; i < 64; i++) amp += bins[i];
    for (let i = 1; i < 8; i++) low += bins[i];
    for (let i = 16; i < 56; i++) high += bins[i];
    amp /= 64 * 255; low /= 7 * 255; high /= 40 * 255;
  }
  level.amp = lerp(level.amp, amp, 0.25);
  level.low = lerp(level.low, low, 0.25);
  level.high = lerp(level.high, high, 0.25);
}

/* ---------- Where the sphere sits for each section ---------- */
// x, y are fractions of the half-viewport; s is scale; o is opacity.
const POSE = {
  hero:      { x: 0.48, y: 0.16, s: 1.25, o: 1 },
  day:       { x: 0.55, y: -0.55, s: 0.6, o: 0.18 },
  tour:      { x: 0.5, y: 0, s: 1.05, o: 0.5 },
  originals: { x: 0, y: 0.05, s: 1.7, o: 0.2 },
  make:      { x: -0.55, y: 0, s: 0.8, o: 0.3 },
  download:  { x: 0, y: 0, s: 1.3, o: 0.7 },
};
const POSE_MOBILE = {
  hero: { x: 0, y: 0.42, s: 0.85, o: 1 },
  tour: { x: 0, y: 0.35, s: 0.75, o: 0.35 },
  make: { x: 0, y: 0, s: 0.8, o: 0.2 },
};
const sections = [...document.querySelectorAll('[data-voice]')];
function currentPose() {
  const mid = innerHeight / 2;
  const sec = sections.find(s => { const r = s.getBoundingClientRect(); return r.top <= mid && r.bottom > mid; }) || sections[0];
  const key = sec.dataset.voice;
  return (mobile() && POSE_MOBILE[key]) || POSE[key];
}

/* ---------- The voice sphere ---------- */
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

async function startVoice() {
  const canvas = document.getElementById('voice');
  let THREE;
  try { THREE = await import('three'); } catch { document.documentElement.classList.add('no-webgl'); return; }
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true }); }
  catch { document.documentElement.classList.add('no-webgl'); return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 50);
  camera.position.z = 4.2;
  const group = new THREE.Group();
  scene.add(group);

  // Points spread evenly over a sphere (Fibonacci lattice).
  const N = innerWidth < 860 ? 7000 : 14000;
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
    uPx: { value: renderer.getPixelRatio() }, uOpacity: { value: 1 },
    uA: { value: new THREE.Color('#22d3ee') }, uB: { value: new THREE.Color('#1f74ec') },
  };
  const points = new THREE.Points(geo, new THREE.ShaderMaterial({
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
  }));
  group.add(points);

  // Soft halo behind the sphere.
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `uniform vec3 uB; uniform float uOpacity, uAmp; varying vec2 vUv;
      void main(){ float d = length(vUv - .5); gl_FragColor = vec4(uB, smoothstep(.5, 0., d) * (.28 + uAmp * .4) * uOpacity); }`,
  }));
  halo.position.z = -1.2;
  scene.add(halo);

  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  resize();

  const mouse = { x: 0, y: 0 };
  addEventListener('pointermove', e => { mouse.x = e.clientX / innerWidth - 0.5; mouse.y = e.clientY / innerHeight - 0.5; });

  const state = { x: 0, y: 0, s: 1, o: 0 };
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    readLevel();
    uniforms.uTime.value += dt * (reduced ? 0.25 : 1);
    uniforms.uAmp.value = level.amp; uniforms.uLow.value = level.low; uniforms.uHigh.value = level.high;

    const halfH = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z;
    const halfW = halfH * camera.aspect;
    const p = currentPose();
    const k = reduced ? 1 : 0.045;
    state.x = lerp(state.x, p.x * halfW, k);
    state.y = lerp(state.y, p.y * halfH, k);
    state.s = lerp(state.s, p.s * (1 + level.low * 0.05), k * 2);
    state.o = lerp(state.o, audio.paused ? p.o : Math.max(p.o, 0.75), k);

    group.position.set(state.x, state.y, 0);
    halo.position.x = state.x; halo.position.y = state.y;
    group.scale.setScalar(state.s);
    halo.scale.setScalar(state.s);
    uniforms.uOpacity.value = state.o;
    if (!reduced) {
      group.rotation.y = lerp(group.rotation.y, uniforms.uTime.value * 0.06 + mouse.x * 0.6, 0.05);
      group.rotation.x = lerp(group.rotation.x, mouse.y * 0.4, 0.05);
    }
    renderer.render(scene, camera);
  });
}
startVoice();

/* ---------- Scroll-driven bits ---------- */
const day = document.getElementById('day');
const track = day.querySelector('.day-track');
const moments = [...track.children];
const wave = document.getElementById('wave-path');
{
  let d = 'M0 35';
  for (let x = 0; x <= 1000; x += 4) {
    const env = 0.35 + 0.65 * Math.abs(Math.sin(x / 90)) * Math.abs(Math.sin(x / 23 + 1));
    d += ` L${x} ${(35 + Math.sin(x * 0.9) * 30 * env).toFixed(1)}`;
  }
  wave.setAttribute('d', d);
}
const waveLen = wave.getTotalLength();
wave.style.strokeDasharray = waveLen;

function onScroll() {
  nav.classList.toggle('scrolled', scrollY > 40);
  if (reduced) return;
  const r = day.getBoundingClientRect();
  const p = clamp(-r.top / (r.height - innerHeight));
  const travel = Math.max(0, track.scrollWidth - innerWidth);
  track.style.transform = `translateX(${-p * travel}px)`;
  const on = Math.round(p * (moments.length - 1));
  moments.forEach((m, i) => m.classList.toggle('on', i === on));
  wave.style.strokeDashoffset = waveLen * (1 - p);
  tourScroll();
}
addEventListener('scroll', onScroll, { passive: true });
addEventListener('resize', onScroll);

/* ---------- Phone tour ---------- */
const phone = document.getElementById('phone');
const tilt = phone.parentElement;
const shot = document.getElementById('shot');
const tour = document.getElementById('tour');
const steps = [...tour.querySelectorAll('.step')];
steps.forEach(s => { new Image().src = `assets/shots/${s.dataset.shot}.webp`; });
let currentShot = 'for-you', spin;
const pointer = { x: 0, y: 0 };
let scrollTurn = 0;

function showShot(name) {
  if (name === currentShot) return;
  currentShot = name;
  const swap = () => { shot.src = `assets/shots/${name}.webp`; };
  if (reduced) return swap();
  spin?.cancel();
  spin = phone.animate([{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(360deg)' }],
    { duration: 1100, easing: 'cubic-bezier(.65,0,.35,1)' });
  setTimeout(swap, 550);
}
const io = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    steps.forEach(s => s.classList.toggle('on', s === e.target));
    showShot(e.target.dataset.shot);
  });
  // On phones the sticky phone covers the top half, so read the step from the lower part.
}, { rootMargin: mobile() ? '-72% 0px -22% 0px' : '-45% 0px -45% 0px' });
steps.forEach(s => io.observe(s));

function applyTilt() {
  tilt.style.transform = `rotateX(${-pointer.y * 16}deg) rotateY(${pointer.x * 26 + scrollTurn}deg)`;
}
function tourScroll() {
  const r = tour.getBoundingClientRect();
  scrollTurn = (clamp(-r.top / (r.height - innerHeight)) - 0.5) * -24;
  applyTilt();
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
const cards = CHANNELS.map((c, i) => {
  const a = document.createElement('a');
  a.className = 'chan';
  a.href = `https://api.audiovibe.co/@${c.handle}`;
  a.target = '_blank'; a.rel = 'noopener';
  a.tabIndex = -1;
  a.innerHTML = `<img src="assets/channels/${c.id}.webp" alt="" width="320" height="320" loading="lazy" draggable="false"><span class="ai">AI</span><span>${c.name}</span>`;
  ring.appendChild(a);
  return a;
});
ringStage.tabIndex = 0;
ringStage.setAttribute('role', 'group');
ringStage.setAttribute('aria-label', 'AudioVibe Originals channels');

let rot = 0, target = null, dragging = false, moved = 0, lastX = 0, hover = false, front = -1;
const info = { name: document.getElementById('chan-name'), about: document.getElementById('chan-about'), link: document.getElementById('chan-link') };

function frontIndex() { return ((Math.round(-rot / STEP) % CHANNELS.length) + CHANNELS.length) % CHANNELS.length; }
function goTo(i) { target = -i * STEP + Math.round((rot + i * STEP) / 360) * 360; }

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

(function ringLoop() {
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
  requestAnimationFrame(ringLoop);
})();

onScroll();
