/* Gym equipment built from Three.js primitives (metres). Each maker returns a Group centred on its natural origin. */
import * as THREE from 'three';

const M = {
  steel: new THREE.MeshStandardMaterial({ color: 0xbfc5c9, metalness: 0.95, roughness: 0.28 }),
  darkSteel: new THREE.MeshStandardMaterial({ color: 0x2b3033, metalness: 0.85, roughness: 0.4 }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x1b1f21, metalness: 0.1, roughness: 0.75 }),
  plate: new THREE.MeshStandardMaterial({ color: 0x23282b, metalness: 0.5, roughness: 0.45 }),
  padBlack: new THREE.MeshStandardMaterial({ color: 0x1d2224, metalness: 0.0, roughness: 0.65 }),
  frame: new THREE.MeshStandardMaterial({ color: 0x3a4245, metalness: 0.7, roughness: 0.45 }),
  accent: new THREE.MeshStandardMaterial({ color: 0x0b7a75, metalness: 0.3, roughness: 0.5 })
};
export const MATS = M;

function cyl(r, len, mat, seg = 24) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat); m.rotation.z = Math.PI / 2; m.castShadow = true; return m; } // along X
function box(w, h, d, mat, r = 0) {
  const g = r ? roundedBox(w, h, d, r) : new THREE.BoxGeometry(w, h, d); const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; return m;
}
export function roundedBox(w, h, d, r, seg = 4) {
  // simple rounded box: scaled sphere-ish via BoxGeometry with bevelled corners using ExtrudeGeometry of a rounded rect
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: d - 2 * Math.min(r, d / 4), bevelEnabled: true, bevelThickness: Math.min(r, d / 4), bevelSize: Math.min(r, d / 4) * 0.8, bevelSegments: seg, curveSegments: 6 });
  g.translate(0, 0, -(d - 2 * Math.min(r, d / 4)) / 2); return g;
}

/* Hex dumbbell. Handle along X. weight is cosmetic. */
export function makeDumbbell(headR = 0.062) {
  const g = new THREE.Group(), hl = 0.065;
  const handle = cyl(0.0125, 0.16, M.steel, 20); g.add(handle);
  for (const sx of [-1, 1]) {
    const head = new THREE.Mesh(new THREE.CylinderGeometry(headR, headR, 0.05, 6), M.rubber); head.rotation.z = Math.PI / 2; head.position.x = sx * (hl + 0.025); head.castShadow = true; g.add(head);
    const collar = cyl(0.02, 0.014, M.steel, 16); collar.position.x = sx * (hl - 0.004); g.add(collar);
    const cap = cyl(0.026, 0.006, M.steel, 16); cap.position.x = sx * (hl + 0.052); g.add(cap);
  }
  return g;
}

/* Olympic barbell along X: 2.2 m bar, sleeves, plates (kg per side as list), collars. */
export function makeBarbell(plates = [20]) {
  const g = new THREE.Group();
  g.add(cyl(0.0145, 1.3, M.steel, 20));
  for (const sx of [-1, 1]) {
    const sleeve = cyl(0.025, 0.42, M.steel, 20); sleeve.position.x = sx * 0.86; g.add(sleeve);
    let x = sx * 0.68;
    for (const kg of plates) {
      const r = kg >= 20 ? 0.225 : kg >= 10 ? 0.19 : kg >= 5 ? 0.15 : 0.11, t = kg >= 20 ? 0.045 : kg >= 10 ? 0.03 : 0.02;
      const p = new THREE.Mesh(new THREE.CylinderGeometry(r, r, t, 40), M.plate); p.rotation.z = Math.PI / 2; p.position.x = x + sx * t / 2; p.castShadow = true; g.add(p);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(r - 0.004, 0.004, 8, 48), M.steel); rim.rotation.y = Math.PI / 2; rim.position.x = x + sx * t; g.add(rim);
      x += sx * (t + 0.002);
    }
    const collar = cyl(0.035, 0.04, M.steel, 20); collar.position.x = x + sx * 0.02; g.add(collar);
  }
  return g;
}

/* Bench: pad top surface at y = 0.43 m, seat starts at z = 0. Back pad length goes toward -Z (head end), flat by default.
   Origin at the middle of the seat, on the floor. backDeg raises the back pad (incline). */
export const BENCH_TOP = 0.45;   // measured top of the pad (the rounded pad is a little taller than its nominal size)
export function makeBench(backDeg = 0) {
  const g = new THREE.Group();
  const seat = box(0.28, 0.07, 0.34, M.padBlack, 0.025); seat.position.set(0, 0.395, 0.17); g.add(seat);
  const back = new THREE.Group(); back.position.set(0, 0.395, -0.01);
  const pad = box(0.28, 0.07, 0.78, M.padBlack, 0.025); pad.position.set(0, 0, -0.39); back.add(pad);
  back.rotation.x = THREE.MathUtils.degToRad(backDeg); g.add(back);
  const tube = (w, h, d) => box(w, h, d, M.frame);
  for (const sx of [-1, 1]) {
    const foot = tube(0.05, 0.045, 0.5); foot.position.set(sx * 0.2, 0.0225, 0.17); g.add(foot);
    const leg = tube(0.045, 0.36, 0.045); leg.position.set(sx * 0.12, 0.21, 0.28); g.add(leg);
    const frame = tube(0.045, 0.04, 0.46); frame.position.set(sx * 0.1, 0.35, 0.05); g.add(frame);
  }
  const rear = tube(0.42, 0.045, 0.05); rear.position.set(0, 0.0225, -0.1); g.add(rear);
  const support = tube(0.05, 0.34, 0.05); support.position.set(0, 0.2, -0.1); g.add(support);
  return g;
}

export function makeFloor() {
  const m = new THREE.Mesh(new THREE.CircleGeometry(1.6, 72), new THREE.MeshStandardMaterial({ color: 0xc5cdc7, roughness: 1 }));
  m.rotation.x = -Math.PI / 2; m.receiveShadow = true; return m;
}
