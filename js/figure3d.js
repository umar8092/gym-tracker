/* 3D exercise figures (Three.js). Replaces the old canvas engine. One shared WebGL renderer draws every visible figure
   and copies the result into that figure's own <canvas>, so a page can show many figures without many GL contexts.
   Public API (same as the old engine): Engine3D.mount(root, exercise), unmountAll(), redraw(). */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Rig } from './fig/rig.js';
import { bakeMuscles, muscleMaterial } from './fig/muscles.js';
import { makeFloor } from './fig/props.js';
import { exerciseFor } from './fig/exercises.js';

const V3 = THREE.Vector3, DEG = Math.PI / 180, ROOT = new URL('../', import.meta.url).href;
const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const ease = x => 0.5 - 0.5 * Math.cos(Math.PI * x);
const norm360 = y => ((y % 360) + 360) % 360, angDist = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
const SKIN_TINT = 0xe6ccbf;

/* ---------- shared renderer + model (loaded once) ---------- */
let sharedP = null, R = null;
function shared() {
  if (sharedP) { return sharedP; }
  sharedP = (async () => {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95; renderer.outputColorSpace = THREE.SRGBColorSpace;
    const pm = new THREE.PMREMGenerator(renderer), env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    const gltf = await new GLTFLoader().loadAsync(ROOT + 'models/Superhero_Male_FullBody.gltf');
    const rig0 = new Rig(gltf.scene); let body0 = null;
    gltf.scene.traverse(o => { if (o.isSkinnedMesh && o.name.includes('SuperHero')) { body0 = o; } });
    bakeMuscles(rig0, body0);
    R = { renderer, env, gltf };
    return R;
  })();
  return sharedP;
}

/* ---------- theme colours from the page's CSS variables ---------- */
function css(name, fallback) { const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim(); return v || fallback; }

/* ---------- dashed path of the weights ---------- */
function dashedPath(points, radius) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal'), pts = curve.getSpacedPoints(110), geos = [];
  for (let i = 0; i < pts.length - 1; i += 2) {
    const a = pts[i], b = pts[i + 1], len = a.distanceTo(b); if (len < 1e-4) { continue; }
    const g = new THREE.CylinderGeometry(radius, radius, len, 6, 1, true), m = new THREE.Matrix4();
    m.compose(a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), b.clone().sub(a).normalize()), new V3(1, 1, 1)); g.applyMatrix4(m); geos.push(g);
  }
  return mergeGeometries(geos);
}

const figures = []; let raf = 0, io = null, observers = [];

function mount(sec, ex) {
  const cv = sec.querySelector('canvas'), seg = sec.querySelectorAll('.seg button'), vb = sec.querySelectorAll('.views button');
  const def = exerciseFor(ex), fig = ex.fig || {};
  const st = {
    ex, def, cv, ctx2d: cv.getContext('2d'), dpr: 1, root: sec, ready: false, fill: sec.querySelector('.bar i'),
    phaseEl: sec.querySelector('.phase'), descEl: sec.querySelector('.desc'),
    btnStart: seg[0], btnEnd: seg[1], btnPlay: seg[2], vBtns: [vb[0], vb[1], vb[2], vb[3], vb[4]], viewKey: '',
    mode: '', t: 0, t0: 0, pausedAt: 0, last: -1, phase: '', yaw: 0, pitch: 11, vel: 0, spin: false, tw: null, dragging: false, dirty: true, lastNow: 0,
    visible: typeof IntersectionObserver === 'undefined', timing: fig.timing || { up: 2.6, top: 0.8, down: 3.6, bottom: 0.8 },
    labels: fig.labels || { up: 'Lift', top: 'Pause', down: 'Lower slowly', bottom: 'Ready' },
    startText: fig.startText || '', endText: fig.endText || ''
  };
  figures.push(st); sec.__st = st;
  st.phaseEl.textContent = 'Loading 3D figure...';

  st.btnStart.addEventListener('click', () => setMode(st, 'start'));
  st.btnEnd.addEventListener('click', () => setMode(st, 'end'));
  st.btnPlay.addEventListener('click', () => setMode(st, st.mode === 'play' ? 'paused' : 'play'));
  vb[0].addEventListener('click', () => turnTo(st, 0, st.def ? st.def.camera.pitch : 11));
  vb[1].addEventListener('click', () => turnTo(st, 90, 11));
  vb[2].addEventListener('click', () => turnTo(st, 180, 11));
  vb[3].addEventListener('click', () => turnTo(st, null, 86));
  vb[4].addEventListener('click', () => { st.spin = !st.spin; st.tw = null; st.vel = 0; st.viewKey = ''; syncViews(st); kick(); });

  cv.addEventListener('pointerdown', e => {
    st.dragging = true; st.dragX = e.clientX; st.dragY = e.clientY; st.lastMove = performance.now(); st.vel = 0; st.tw = null; st.spin = false;
    try { cv.setPointerCapture(e.pointerId); } catch (err) {} cv.style.cursor = 'grabbing';
  });
  cv.addEventListener('pointermove', e => {
    if (!st.dragging) { return; }
    const now = performance.now(), dx = e.clientX - st.dragX, dy = e.clientY - st.dragY, dt = Math.max(1, now - st.lastMove);
    st.dragX = e.clientX; st.dragY = e.clientY; st.lastMove = now;
    const d = -dx * 0.6; st.yaw += d; st.vel = 0.7 * st.vel + 0.3 * (d / dt);
    if (e.pointerType === 'mouse') { st.pitch = Math.min(88, Math.max(-5, st.pitch + dy * 0.4)); }   // touch keeps vertical swipes for scrolling the page
    st.dirty = true; kick();
  });
  const endDrag = () => { if (st.dragging) { st.dragging = false; cv.style.cursor = 'grab'; kick(); } };
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(n => cv.addEventListener(n, endDrag));
  cv.addEventListener('keydown', e => {
    const k = { ArrowLeft: [15, 0], ArrowRight: [-15, 0], ArrowUp: [0, 8], ArrowDown: [0, -8] }[e.key];
    if (k) { st.yaw += k[0]; st.pitch = Math.min(88, Math.max(-5, st.pitch + k[1])); st.spin = false; st.tw = null; st.dirty = true; kick(); e.preventDefault(); }
  });
  if (typeof ResizeObserver !== 'undefined') { const ro = new ResizeObserver(() => { resize(st); kick(); }); ro.observe(cv); observers.push(ro); }
  resize(st);

  if (typeof IntersectionObserver !== 'undefined') {
    if (!io) {
      io = new IntersectionObserver(entries => {
        entries.forEach(en => { const s = en.target.__st; if (!s) { return; } s.visible = en.isIntersecting; if (s.visible) { resize(s); s.lastNow = 0; } });
        kick();
      }, { threshold: 0.1 });
    }
    io.observe(sec);
  }

  if (!def) { st.phaseEl.textContent = '3D figure coming soon'; return st; }
  shared().then(sh => build(st, sh)).catch(err => { st.phaseEl.textContent = '3D is not available on this device.'; console.error(err); });
  return st;
}

function build(st, sh) {
  const def = st.def, scene = new THREE.Scene(); scene.environment = sh.env; scene.environmentIntensity = 0.55;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a9a94, 0.45));
  const key = new THREE.DirectionalLight(0xffffff, 2.3); key.position.set(-2.2, 4, 3.2); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -2.2, right: 2.2, top: 2.6, bottom: -1.2, near: 0.5, far: 12 }); key.shadow.bias = -0.0004; key.shadow.radius = 4; scene.add(key);
  const rimL = new THREE.DirectionalLight(0xbfe9e4, 1.0); rimL.position.set(3, 2, -3); scene.add(rimL);

  const root = SkeletonUtils.clone(sh.gltf.scene); let body = null;
  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } if (o.isSkinnedMesh && o.name.includes('SuperHero')) { body = o; } });
  const mm = muscleMaterial(body); body.material.color.set(SKIN_TINT);
  mm.set(st.ex.mus ? st.ex.mus.p : [], st.ex.mus ? st.ex.mus.s : []);
  scene.add(root);
  const floor = makeFloor(); floor.material.transparent = true; floor.material.opacity = 0.55; scene.add(floor);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.6, 48), new THREE.ShadowMaterial({ opacity: 0.22 })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.002; shadow.receiveShadow = true; scene.add(shadow);

  const rig = new Rig(root), ctx = { rig, scene, root, body }, props = def.setup(ctx);
  props.ctx = ctx; Object.assign(st, { scene, rig, props, mm, floor, cam: new THREE.PerspectiveCamera(30, 1, 0.05, 40), body });
  // path of the weights, sampled over the rep
  const samples = []; for (let i = 0; i <= 24; i++) { samples.push(def.pose(props, i / 24).grips); }
  st.nGrips = samples[0].length; st.samples = samples;
  st.trail = new THREE.Group(); scene.add(st.trail); st.trailMats = [];
  for (let g = 0; g < st.nGrips; g++) {
    const pts = samples.map(s => s[g]), halo = new THREE.Mesh(dashedPath(pts, 0.011), new THREE.MeshBasicMaterial({ depthTest: false, transparent: true, opacity: 0.9 }));
    const ink = new THREE.Mesh(dashedPath(pts, 0.0055), new THREE.MeshBasicMaterial({ depthTest: false, transparent: true, opacity: 0.95 }));
    halo.renderOrder = 10; ink.renderOrder = 11; st.trail.add(halo, ink); st.trailMats.push([halo.material, ink.material]);
  }
  st.arrows = []; for (let g = 0; g < st.nGrips; g++) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.075, 16), new THREE.MeshBasicMaterial({ depthTest: false })); cone.renderOrder = 12; st.trail.add(cone); st.arrows.push(cone);
  }
  st.camState = Object.assign({ tx: 0 }, def.camera); st.yaw = def.camera.yaw; st.pitch = def.camera.pitch; st.ready = true;
  setMode(st, reduce ? 'start' : 'play'); syncViews(st);
}

/* ---------- controls and animation state ---------- */
function setBar(st, e) { st.fill.style.width = Math.round(e * 100) + '%'; }
function syncButtons(st) {
  st.btnStart.setAttribute('aria-pressed', String(st.mode === 'start')); st.btnEnd.setAttribute('aria-pressed', String(st.mode === 'end'));
  st.btnPlay.setAttribute('aria-pressed', String(st.mode === 'play')); st.btnPlay.textContent = st.mode === 'play' ? 'Pause' : 'Play';
}
function syncViews(st) {
  const y = norm360(st.yaw), top = st.pitch > 70;
  const key = [!top && angDist(y, 0) < 5, !top && (angDist(y, 90) < 5 || angDist(y, 270) < 5), !top && angDist(y, 180) < 5, top, st.spin].join();
  if (key === st.viewKey) { return; }
  st.viewKey = key; key.split(',').forEach((f, k) => st.vBtns[k].setAttribute('aria-pressed', f));
}
function setMode(st, mode) {
  const now = performance.now(), prev = st.mode; st.mode = mode;
  if (mode === 'start' || mode === 'end') {
    st.t = mode === 'start' ? 0 : 1; st.phaseEl.textContent = mode === 'start' ? 'Start position' : 'End position';
    st.descEl.textContent = mode === 'start' ? st.startText : st.endText; st.last = st.t; st.phase = ''; setBar(st, st.t);
  } else if (mode === 'play') {
    if (prev === 'paused') { st.t0 += now - st.pausedAt; } else { st.t0 = now; }
    st.descEl.textContent = 'Slow rep. Tap Start or End to freeze a position. Drag to look from any angle, or tap Top for a view from above.'; st.last = -1; st.phase = '';
  } else if (mode === 'paused') { st.pausedAt = now; }
  st.dirty = true; syncButtons(st); kick();
}
function turnTo(st, yawTarget, pitchTarget) {
  const from = st.yaw; let delta = 0;
  if (yawTarget !== null) {
    const opts = yawTarget === 90 ? [90, 270] : [yawTarget]; let bd = 1e9;
    opts.forEach(o => { const d = ((o - norm360(from) + 540) % 360) - 180; if (Math.abs(d) < bd) { bd = Math.abs(d); delta = d; } });
  }
  st.spin = false; st.vel = 0;
  if (reduce) { st.yaw += delta; st.pitch = pitchTarget; st.dirty = true; syncViews(st); kick(); return; }
  st.tw = { from, delta, p0: st.pitch, p1: pitchTarget, t0: performance.now(), dur: 650 }; kick();
}
function resize(st) {
  const r = st.cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
  if (w && (st.cv.width !== w || st.cv.height !== h)) { st.cv.width = w; st.cv.height = h; }
  st.dpr = dpr; st.dirty = true;
}

/* ---------- drawing ---------- */
function draw(st) {
  const W = st.cv.width, H = st.cv.height; if (!W || !H || !st.ready) { return; }
  const { renderer } = R, def = st.def, c = st.camState, cam = st.cam;
  st.def.pose(st.props, st.t);
  const ink = css('--ink', '#1B2422'), bg = css('--bg', '#ECEFE9'), line = css('--line', '#C5CDC7'), muted = css('--muted', '#55635F');
  st.floor.material.color.set(line); st.trailMats.forEach(([h, i]) => { h.color.set(bg); i.color.set(ink); }); st.arrows.forEach(a => a.material.color.set(ink));
  // arrowhead follows the movement: up = along the path, down = reversed, holds = hidden
  const n = 24; let idx = -1, dir = 1;
  if (st.mode === 'start') { idx = n; dir = 1; } else if (st.mode === 'end') { idx = 0; dir = -1; }
  else if (st.phase === 'up') { idx = Math.min(n, Math.round(st.t * n) + 4); dir = 1; } else if (st.phase === 'down') { idx = Math.max(0, Math.round(st.t * n) - 4); dir = -1; }
  st.arrows.forEach((a, g) => {
    a.visible = idx >= 0; if (idx < 0) { return; }
    const p = st.samples[idx][g], q = st.samples[Math.min(n, Math.max(0, idx - dir * 3))][g], d = p.clone().sub(q);
    if (d.length() < 1e-4) { a.visible = false; return; }
    a.position.copy(p); a.quaternion.setFromUnitVectors(new V3(0, 1, 0), d.normalize());
  });
  const ay = st.yaw * DEG, ap = st.pitch * DEG, dist = c.dist, tgt = new V3(c.tx || 0, c.ty, c.tz || 0);
  cam.aspect = W / H; cam.updateProjectionMatrix();
  cam.position.set(tgt.x + Math.sin(ay) * Math.cos(ap) * dist, tgt.y + Math.sin(ap) * dist, tgt.z + Math.cos(ay) * Math.cos(ap) * dist);
  cam.up.set(0, 1, 0); cam.lookAt(tgt);
  if (st.pitch > 80) { cam.up.set(-Math.sin(ay), 0, -Math.cos(ay)); cam.lookAt(tgt); }   // looking straight down: keep the figure's head toward the top of the frame
  renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0); renderer.render(st.scene, cam);
  st.ctx2d.clearRect(0, 0, W, H); st.ctx2d.drawImage(renderer.domElement, 0, 0, W, H);
}

function tick(now) {
  let any = false;
  figures.forEach(st => {
    if (!st.visible || !st.ready) { return; }
    const dt = st.lastNow ? Math.min(60, now - st.lastNow) : 16; st.lastNow = now;
    let dirty = st.dirty; st.dirty = false;
    if (st.mode === 'play') {
      any = true;
      const c = st.timing, cyc = c.up + c.top + c.down + c.bottom, p = ((now - st.t0) / 1000) % cyc; let e, ph;
      if (p < c.up) { e = ease(p / c.up); ph = 'up'; } else if (p < c.up + c.top) { e = 1; ph = 'top'; }
      else if (p < c.up + c.top + c.down) { e = 1 - ease((p - c.up - c.top) / c.down); ph = 'down'; } else { e = 0; ph = 'bottom'; }
      if (Math.abs(e - st.last) > 0.002) { st.t = e; st.last = e; setBar(st, e); dirty = true; }
      if (ph !== st.phase) { st.phase = ph; st.phaseEl.textContent = st.labels[ph]; dirty = true; }
    }
    if (st.tw) {
      any = true; const q = Math.min(1, (now - st.tw.t0) / st.tw.dur), k = ease(q);
      st.yaw = st.tw.from + st.tw.delta * k; st.pitch = st.tw.p0 + (st.tw.p1 - st.tw.p0) * k; dirty = true; if (q >= 1) { st.tw = null; }
    } else if (st.spin && !st.dragging) { any = true; st.yaw -= 0.045 * dt; dirty = true; }
    else if (!st.dragging && Math.abs(st.vel) > 0.003) { any = true; st.yaw += st.vel * dt; st.vel *= Math.exp(-dt / 320); dirty = true; }
    if (dirty) { draw(st); syncViews(st); }
  });
  raf = any ? requestAnimationFrame(tick) : 0;
}
function kick() { if (!raf) { raf = requestAnimationFrame(tick); } }
function unmountAll() {
  figures.forEach(st => { if (st.scene) { st.scene.traverse(o => { if (o.geometry && !o.isSkinnedMesh) { o.geometry.dispose(); } }); } });
  figures.length = 0; observers.forEach(o => o.disconnect()); observers.length = 0; if (io) { io.disconnect(); io = null; }
  if (raf) { cancelAnimationFrame(raf); raf = 0; }
}
window.addEventListener('resize', () => { figures.forEach(resize); kick(); });

window.Engine3D = { mount, unmountAll, redraw() { figures.forEach(s => { s.dirty = true; }); kick(); }, supports: ex => !!exerciseFor(ex), ok: true };
