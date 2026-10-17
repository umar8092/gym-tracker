/* One entry per exercise id. Each entry builds its props and poses the rig for rep position t (0 = start, 1 = end).
   pose() returns { grips: [Vector3...] } = the points whose path is drawn as the dashed line.
   Coordinates: metres, +Y up, +Z in front of the figure, +X the figure's left. */
import * as THREE from 'three';
import { makeDumbbell, makeBarbell, makeBench } from './props.js';
import { fromKeys, armKeysPose } from './poses.js';

const V3 = THREE.Vector3;
const DEG = Math.PI / 180;

export function placeInHand(rig, obj, s, fr, along = 0.075, up = 0.035) {
  obj.position.copy(rig.wp('hand_' + s)).add(fr.f.clone().multiplyScalar(along)).add(fr.n.clone().multiplyScalar(up));
  obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(fr.B, fr.n, new V3().crossVectors(fr.B, fr.n)));
}

// legs planted on the floor: ankles at targets (default: where they stand at rest), knees pointing along pole
export function plantFeet(rig, offs = {}, pole = new V3(0, 0, 1)) {
  for (const s of ['l', 'r']) {
    const T = rig.rest['foot_' + s].p.clone().add(offs[s] || new V3());
    rig.legIK(s, T, pole.clone(), new V3(0, 0, 1), new V3(0, 1, 0));
  }
}

/* Standing dumbbell exercises defined by direction keys (the shoulder moves validated earlier). */
export function keysExercise(fig) {
  const keys = fromKeys(fig), bend = fig.bendDeg || 0;
  return {
    camera: { ty: (fig.cam.ty / 100) * 1.02, tz: (fig.cam.tz || 0) / 100, dist: (fig.cam.span / 100 * 1.02) / 0.536, yaw: fig.yaw, pitch: 11 },
    setup(ctx) { const db = [makeDumbbell(), makeDumbbell()]; db.forEach(d => ctx.scene.add(d)); return { db, ctx }; },
    pose(st, t) {
      const rig = st.ctx.rig; rig.reset();
      if (bend) {
        const hip = rig.rest.pelvis.p.clone();
        rig.setWP('pelvis', hip.clone().add(new V3(0, -0.05, -0.15)));
        rig.setWQ('pelvis', new THREE.Quaternion().setFromAxisAngle(new V3(1, 0, 0), bend * DEG).multiply(rig.rest.pelvis.q.clone()));
        plantFeet(rig, {}, new V3(0, 0, 1));
        rig.turn('neck_01', new V3(1, 0, 0), -38); rig.turn('Head', new V3(1, 0, 0), -22);   // keep the neck in line with a flat back, eyes toward the floor ahead
      }
      const fr = armKeysPose(rig, keys, t);
      placeInHand(rig, st.db[0], 'l', fr.l); placeInHand(rig, st.db[1], 'r', fr.r);
      return { grips: [st.db[0].position.clone(), st.db[1].position.clone()] };
    }
  };
}

/* ---------- shared helpers for lying / bench work ---------- */
const Q = THREE.Quaternion;
const Rx = deg => new Q().setFromAxisAngle(new V3(1, 0, 0), deg * DEG);
const mir = v => new V3(-v.x, v.y, v.z);
export function gripFrame(F, N) {  // orthonormal finger/palm vectors, so wrist targets can be derived from a grip point
  const f = F.clone().normalize(), n = N.clone().sub(f.clone().multiplyScalar(N.dot(f))).normalize(); return { f, n };
}
// wrist target so that the grip point (hand centre) lands on G
export function wristFor(G, F, N, along = 0.075, up = 0.035) { const g = gripFrame(F, N); return G.clone().sub(g.f.multiplyScalar(along)).sub(g.n.multiplyScalar(up)); }
// body lying on a bench with its torso pitched by pitchDeg (-90 = flat on the back, -60 = 30 degree incline)
export function lieOnBench(rig, pelvis, pitchDeg) {
  rig.setWP('pelvis', pelvis); rig.setWQ('pelvis', Rx(pitchDeg).multiply(rig.rest.pelvis.q.clone()));
}
// lowest body point (skinned vertices) inside a floor region; used once to sit the body exactly on the pad
export function lowestPoint(body, test) {
  body.skeleton.update(); const v = new V3(); let m = Infinity, n = body.geometry.attributes.position.count;
  for (let i = 0; i < n; i++) { body.getVertexPosition(i, v); v.applyMatrix4(body.matrixWorld); if (test(v) && v.y < m) { m = v.y; } }
  return m;
}
export function highestPoint(body, test) {
  body.skeleton.update(); const v = new V3(); let m = -Infinity, n = body.geometry.attributes.position.count;
  for (let i = 0; i < n; i++) { body.getVertexPosition(i, v); v.applyMatrix4(body.matrixWorld); if (test(v) && v.y > m) { m = v.y; } }
  return m;
}
function legsOnFloor(rig, spread = 0.2, z = 0.5, pole = new V3(0.15, 1, 0.3)) {
  for (const s of ['l', 'r']) {
    const sg = s === 'l' ? 1 : -1;
    rig.legIK(s, new V3(sg * spread, rig.rest['foot_' + s].p.y, z), new V3(sg * pole.x, pole.y, pole.z), new V3(sg * 0.15, 0, 1), new V3(0, 1, 0));
  }
}
const lerp3 = (a, b, t) => a.clone().lerp(b, t);

// highest extent of the body along `normal` above the point c, within `radius` of the line through c (measured on the posed mesh)
export function surfaceAlong(body, c, normal, radius) {
  body.skeleton.update(); const v = new V3(), d = new V3(); let m = -Infinity, n = body.geometry.attributes.position.count;
  for (let i = 0; i < n; i++) {
    body.getVertexPosition(i, v); v.applyMatrix4(body.matrixWorld); d.copy(v).sub(c); const h = d.dot(normal);
    if (d.addScaledVector(normal, -h).length() < radius && h > m) { m = h; }
  }
  return m;
}

/* Barbell or dumbbell press lying on a bench. opts: incline (deg of the back pad), bar (true = barbell), grip half-width, bottomZ (how far
   below the shoulder line the weight touches the chest), topSpread (hand spacing at the top relative to the bottom). */
function pressExercise(o) {
  const incline = o.incline || 0, pitch = -90 + incline, halfW = o.halfW || 0.3, rad = o.bar ? 0.0145 : 0.075;
  const F = new V3(0, 1, -0.25), N = new V3(0, 0.25, 1);   // forearm vertical, palms toward the feet, slight wrist extension
  const u = new V3(0, 1, 0).applyQuaternion(Rx(pitch)), nF = new V3(0, 0, 1).applyQuaternion(Rx(pitch));   // torso axis (toward the head) and chest normal
  const gf = gripFrame(F, N), grip = gf.f.clone().multiplyScalar(0.075).add(gf.n.clone().multiplyScalar(0.035));   // wrist -> hand centre
  const pelvisAt = dy => new V3(0, 0.6 + dy, 0.12 - (incline ? 0 : 0));
  return {
    camera: Object.assign({ ty: 0.62, tz: -0.1, dist: 3.4, yaw: 28, pitch: 24 }, o.camera || {}),
    setup(ctx) {
      const bench = makeBench(incline); ctx.scene.add(bench);
      const hold = o.bar ? makeBarbell(o.plates || [20, 10]) : [makeDumbbell(), makeDumbbell()];
      (o.bar ? [hold] : hold).forEach(h => ctx.scene.add(h));
      const st = { ctx, bench, hold, dy: 0 }, rig = ctx.rig;
      // sit the body on the pad: measure the lowest back/glute point, then drop to touch it
      rig.reset(); lieOnBench(rig, pelvisAt(0), pitch); legsOnFloor(rig); ctx.root.updateMatrixWorld(true);
      const low = lowestPoint(ctx.body, v => Math.abs(v.x) < 0.2 && v.z < 0.3 && v.z > -0.6 && v.y < 0.8);
      st.dy = 0.43 - low + 0.004;
      rig.reset(); lieOnBench(rig, pelvisAt(st.dy), pitch); legsOnFloor(rig); ctx.root.updateMatrixWorld(true);
      // where the weight touches the chest: bz below the shoulder line along the torso, surface found on the mesh
      const S0 = rig.wp('upperarm_l'), C = new V3(0, S0.y, S0.z).addScaledVector(u, -(o.bottomZ || 0.13));
      st.touch = C.clone().addScaledVector(nF, surfaceAlong(ctx.body, C, nF, 0.04) + rad + (o.bar ? 0 : 0.02));
      return st;
    },
    pose(st, t) {
      const rig = st.ctx.rig; rig.reset();
      lieOnBench(rig, pelvisAt(st.dy), pitch); legsOnFloor(rig);
      const S = rig.wp('upperarm_l'), reach = rig.len.arm_l[0] + rig.len.arm_l[1];
      const gb = new V3(halfW, st.touch.y, st.touch.z);
      // lockout: wrist straight above the shoulder (slightly in), arms ~97% extended; grip point = wrist + hand offset
      const dx = halfW * (o.topSpread || 0.9) - S.x, wz = 0.03, wt = new V3(S.x + dx, S.y + Math.sqrt(Math.pow(reach * 0.97, 2) - dx * dx - wz * wz), S.z + wz), gt = wt.clone().add(grip);
      const G = lerp3(gb, gt, t), gl = G.clone(), gr = new V3(-G.x, G.y, G.z);
      const pole = new V3(0.7, -0.6, 0.25 + 0.35 * t), wl = wristFor(gl, F, N), wr = wristFor(gr, mir(F), mir(N));
      const a = rig.armIK('l', wl, pole, F, N, 1), b = rig.armIK('r', wr, mir(pole), mir(F), mir(N), 1);
      if (o.bar) { st.hold.position.set(0, G.y, G.z); st.hold.rotation.set(0, 0, 0); }
      else { placeInHand(rig, st.hold[0], 'l', a.frame); placeInHand(rig, st.hold[1], 'r', b.frame); }
      return { grips: o.bar ? [gl.clone().setX(0)] : [gl, gr], diag: { reach: [a.reached, b.reached], bar: o.bar ? { y: G.y, z: G.z, r: rad } : null } };
    }
  };
}

export const EXERCISES = {
  'barbell-bench-press': pressExercise({ bar: true, halfW: 0.31 }),
  'incline-dumbbell-press': pressExercise({ bar: false, incline: 30, halfW: 0.26, topSpread: 0.78, camera: { yaw: 35, pitch: 18 } })
};
export function exerciseFor(ex) {
  if (EXERCISES[ex.id]) { return EXERCISES[ex.id]; }
  if (ex.fig && ex.fig.U) { return keysExercise(ex.fig); }
  return null;
}
