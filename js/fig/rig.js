/* Skeleton helper for the Quaternius Superhero male (UE-style bone names, T-pose rest).
   World space: +Y up, +Z in front of the figure, +X is the figure's LEFT. Poses are applied every frame from rest, so nothing accumulates. */
import * as THREE from 'three';

const V3 = THREE.Vector3, Q = THREE.Quaternion;
const CHILD = { upperarm_l: 'lowerarm_l', lowerarm_l: 'hand_l', upperarm_r: 'lowerarm_r', lowerarm_r: 'hand_r',
  thigh_l: 'calf_l', calf_l: 'foot_l', thigh_r: 'calf_r', calf_r: 'foot_r', foot_l: 'ball_l', foot_r: 'ball_r',
  spine_01: 'spine_02', spine_02: 'spine_03', spine_03: 'neck_01', neck_01: 'Head', pelvis: 'spine_01', clavicle_l: 'upperarm_l', clavicle_r: 'upperarm_r' };
const FINGERS = ['index', 'middle', 'ring', 'pinky'];
const CHILD_THUMB = { thumb_01_l: 'thumb_02_l', thumb_02_l: 'thumb_03_l', thumb_03_l: 'thumb_04_leaf_l', thumb_01_r: 'thumb_02_r', thumb_02_r: 'thumb_03_r', thumb_03_r: 'thumb_04_leaf_r' };

export class Rig {
  constructor(root) {
    this.root = root; this.b = {};
    root.traverse(o => { if (o.isBone) { this.b[o.name] = o; } });
    root.updateMatrixWorld(true);
    this.rest = {};
    for (const n in this.b) {
      const o = this.b[n];
      this.rest[n] = { p: o.getWorldPosition(new V3()), q: o.getWorldQuaternion(new Q()), lp: o.position.clone(), lq: o.quaternion.clone() };
    }
    this.len = {};
    for (const s of ['l', 'r']) {
      this.len['arm_' + s] = [this.dist('upperarm_' + s, 'lowerarm_' + s), this.dist('lowerarm_' + s, 'hand_' + s)];
      this.len['leg_' + s] = [this.dist('thigh_' + s, 'calf_' + s), this.dist('calf_' + s, 'foot_' + s)];
    }
    // rest hand frame: f0 = fingers direction, n0 = palm normal (out of the palm), B0 = f0 x n0
    this.handRest = {};
    for (const s of ['l', 'r']) {
      const f0 = this.rest['middle_01_' + s].p.clone().sub(this.rest['hand_' + s].p).normalize();
      const K0 = this.rest['index_01_' + s].p.clone().sub(this.rest['pinky_01_' + s].p).normalize(); // pinky -> index
      let n0 = new V3().crossVectors(f0, K0).normalize();
      if (n0.y > 0) { n0.negate(); }                                // rest palms face the floor
      this.handRest[s] = { f: f0, n: n0, B: new V3().crossVectors(f0, n0).normalize() };
    }
    // rest foot frame (feet are flat in the rest pose): f0 = ankle -> ball of foot, u0 = top of the foot
    this.footRest = {};
    for (const s of ['l', 'r']) {
      const f0 = this.rest['ball_' + s].p.clone().sub(this.rest['foot_' + s].p).normalize();
      const side = new V3().crossVectors(f0, new V3(0, 1, 0)).normalize(), u0 = new V3().crossVectors(side, f0).normalize();
      this.footRest[s] = { f: f0, u: u0, B: new V3().crossVectors(f0, u0).normalize() };
    }
  }
  dist(a, b) { return this.rest[a].p.distanceTo(this.rest[b].p); }
  reset() {
    for (const n in this.b) { this.b[n].position.copy(this.rest[n].lp); this.b[n].quaternion.copy(this.rest[n].lq); }
    this.root.updateMatrixWorld(true);
  }
  wq(n) { return this.b[n].getWorldQuaternion(new Q()); }
  wp(n) { return this.b[n].getWorldPosition(new V3()); }
  setWQ(n, q) {
    const o = this.b[n], pq = o.parent.getWorldQuaternion(new Q());
    o.quaternion.copy(pq.invert().multiply(q)); o.updateMatrixWorld(true);
  }
  setWP(n, p) { const o = this.b[n]; o.position.copy(o.parent.worldToLocal(p.clone())); o.updateMatrixWorld(true); }
  // world rotation this bone would have if it just moved rigidly with its parent
  follow(n) {
    const o = this.b[n], pn = o.parent.name, rel = this.rest[pn].q.clone().invert().multiply(this.rest[n].q);
    return this.wq(pn).multiply(rel);
  }
  // rotate bone n (following its parent) so that its bone axis points along dir. extra = optional world rotation applied first.
  aim(n, dir, base) {
    const q0 = base ? base.clone() : this.follow(n), rest = this.rest[n];
    const restDir = this.rest[CHILD[n]].p.clone().sub(rest.p).normalize();
    const cur = restDir.applyQuaternion(q0.clone().multiply(rest.q.clone().invert()));
    const q = new Q().setFromUnitVectors(cur, dir.clone().normalize()).multiply(q0);
    this.setWQ(n, q); return q;
  }
  // world-axis rotation (about the bone's own pivot) added on top of "follow parent"
  turn(n, axis, deg, base) {
    const q = new Q().setFromAxisAngle(axis.clone().normalize(), THREE.MathUtils.degToRad(deg)).multiply(base ? base.clone() : this.follow(n));
    this.setWQ(n, q); return q;
  }

  /* ---------- arms ---------- */
  // FK from direction vectors (world): U upper arm, F forearm, N palm normal. Used by the dumbbell raises and presses.
  armFK(s, U, F, N, curl = 1) {
    this.aim('upperarm_' + s, U); this.aim('lowerarm_' + s, F);
    return this.handFrame(s, F, N, curl);
  }
  // two-bone IK: hand to target T, elbow pushed toward pole direction P, then hand frame (F, N)
  armIK(s, T, P, F, N, curl = 1) {
    const S = this.wp('upperarm_' + s), [l1, l2] = this.len['arm_' + s];
    const sol = solve2(S, T, P, l1, l2);
    this.aim('upperarm_' + s, sol.mid.clone().sub(S)); this.aim('lowerarm_' + s, sol.end.clone().sub(sol.mid));
    const fr = this.handFrame(s, F || sol.end.clone().sub(sol.mid), N, curl);
    return { wrist: sol.end, reached: sol.reached, frame: fr };
  }
  // orient the hand so fingers point along F with palm normal N, then close the fingers around a grip axis (B)
  handFrame(s, F, N, curl) {
    const hr = this.handRest[s], f = F.clone().normalize(), n = N.clone().sub(f.clone().multiplyScalar(N.dot(f))).normalize();
    const B = new V3().crossVectors(f, n).normalize();
    const R = basis(f, n, B).multiply(basis(hr.f, hr.n, hr.B).invert());
    this.setWQ('hand_' + s, R.multiply(this.rest['hand_' + s].q.clone()));
    this.lastN = n; this.curlFingers(s, B, curl);
    return { f, n, B };
  }
  curlFingers(s, B, amount) {
    const per = { index: [62, 70, 45], middle: [66, 72, 46], ring: [70, 74, 48], pinky: [72, 74, 48] };
    for (const fn of FINGERS) {
      for (let j = 1; j <= 3; j++) {
        const name = fn + '_0' + j + '_' + s;
        if (this.b[name]) { this.turn(name, B, per[fn][j - 1] * amount); }
      }
    }
    // thumb: flex about each segment's own flexion axis (segment direction x palm normal), plus a roll that brings it across the handle
    const cfg = this.thumbCfg || { roll: [-70, -20, 0], flex: [10, 45, 45] }, n = this.lastN;
    ['thumb_01_', 'thumb_02_', 'thumb_03_'].forEach((pre, i) => {
      const name = pre + s, o = this.b[name]; if (!o) { return; }
      const child = this.b[CHILD_THUMB[name]] || null;
      const base = this.follow(name);
      const dir = child ? child.getWorldPosition(new V3()).sub(o.getWorldPosition(new V3())).normalize() : this.handRest[s].f.clone();
      const axFlex = new V3().crossVectors(dir, n).normalize();
      let q = base;
      if (cfg.roll[i]) { q = new Q().setFromAxisAngle(dir, THREE.MathUtils.degToRad(cfg.roll[i] * (s === 'l' ? 1 : -1))).multiply(q); }
      q = new Q().setFromAxisAngle(axFlex, THREE.MathUtils.degToRad(cfg.flex[i] * amount)).multiply(q);
      this.setWQ(name, q);
    });
  }

  /* ---------- legs ---------- */
  legIK(s, T, P, footF, footUp) {
    const S = this.wp('thigh_' + s), [l1, l2] = this.len['leg_' + s];
    const sol = solve2(S, T, P, l1, l2);
    this.aim('thigh_' + s, sol.mid.clone().sub(S)); this.aim('calf_' + s, sol.end.clone().sub(sol.mid));
    if (footF) { this.footFrame(s, footF, footUp || new V3(0, 1, 0)); }
    return { ankle: sol.end, reached: sol.reached };
  }
  // relaxed foot that follows the lower leg (no twist), pointed by `plantar` degrees; for hanging or resting legs
  relaxFoot(s, plantar) {
    const calf = 'calf_' + s, d = this.wq(calf).multiply(this.rest[calf].q.clone().invert()), axis = new V3(1, 0, 0).applyQuaternion(d);
    this.turn('foot_' + s, axis, plantar);
  }
  // flat foot on the floor, toes turned out by `out` degrees
  flatFoot(s, out = 0) {
    const fr = this.footRest[s], a = THREE.MathUtils.degToRad(out * (s === 'l' ? 1 : -1)), q = new Q().setFromAxisAngle(new V3(0, 1, 0), a);
    this.footFrame(s, fr.f.clone().applyQuaternion(q), fr.u.clone().applyQuaternion(q));
  }
  footFrame(s, f, up) {
    const fr = this.footRest[s], ff = f.clone().normalize(), u = up.clone().sub(ff.clone().multiplyScalar(up.dot(ff))).normalize();
    const B = new V3().crossVectors(ff, u).normalize();
    const R = basis(ff, u, B).multiply(basis(fr.f, fr.u, fr.B).invert());
    this.setWQ('foot_' + s, R.multiply(this.rest['foot_' + s].q.clone()));
  }
}

function basis(a, b, c) { return new Q().setFromRotationMatrix(new THREE.Matrix4().makeBasis(a, b, c)); }

// law-of-cosines two-bone solver. Returns elbow/knee position and the end position actually reached.
export function solve2(S, T, P, l1, l2) {
  const dv = T.clone().sub(S); let d = dv.length(); const dir = dv.clone().divideScalar(d || 1);
  const maxD = (l1 + l2) * 0.999, minD = Math.abs(l1 - l2) * 1.001 + 1e-4;
  const reached = d <= maxD && d >= minD; d = Math.min(Math.max(d, minD), maxD);
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  let perp = P.clone().sub(dir.clone().multiplyScalar(P.dot(dir)));
  if (perp.lengthSq() < 1e-8) { perp = new V3(0, 0, 1).sub(dir.clone().multiplyScalar(dir.z)); }
  perp.normalize();
  const mid = S.clone().add(dir.clone().multiplyScalar(a)).add(perp.multiplyScalar(h));
  return { mid, end: S.clone().add(dir.multiplyScalar(d)), reached };
}
