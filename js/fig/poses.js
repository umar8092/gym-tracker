/* Exercise poses. Each pose function receives (rig, t, api) and moves the figure for rep position t (0 = start, 1 = end). */
import * as THREE from 'three';
const V3 = THREE.Vector3;

export function vslerp(a, b, t) {
  const d = Math.min(1, Math.max(-1, a.dot(b))), w = Math.acos(d);
  if (w < 1e-4) { return a.clone(); }
  const s = Math.sin(w);
  return a.clone().multiplyScalar(Math.sin((1 - t) * w) / s).add(b.clone().multiplyScalar(Math.sin(t * w) / s));
}
export function keyDir(arr, t) { return t < 0.5 ? vslerp(arr[0], arr[1], t * 2) : vslerp(arr[1], arr[2], (t - 0.5) * 2); }
const mirror = v => new V3(-v.x, v.y, v.z);
const U = a => new V3(a[0], a[1], a[2]).normalize();

/* Shoulder exercises from the validated prototype: direction keys for upper arm (U), forearm (F), palm normal (N).
   Left arm as authored (x = figure's left), right arm mirrored. Dumbbells sit in the hands. */
export function fromKeys(fig) {
  const keys = { U: fig.U.map(U), F: fig.F.map(U), N: fig.N.map(U) };
  if (keys.N.length === 2) { keys.N = [keys.N[0], vslerp(keys.N[0], keys.N[1], 0.5), keys.N[1]]; }
  return keys;
}
export function armKeysPose(rig, keys, t, bendDeg = 0) {
  const u = keyDir(keys.U, t), f = keyDir(keys.F, t), n = keyDir(keys.N, t), out = {};
  if (bendDeg) { hinge(rig, bendDeg); }
  for (const s of ['l', 'r']) {
    const m = s === 'l' ? x => x : mirror;
    const U3 = m(u), F3 = m(f), N3 = m(n);
    if (bendDeg) { const R = hingeRot(rig, bendDeg); U3.applyQuaternion(R); F3.applyQuaternion(R); N3.applyQuaternion(R); }
    out[s] = rig.armFK(s, U3, F3, N3, 1);
  }
  return out;
}
// forward hip hinge: rotate the pelvis (and everything above it) about the hip axis; legs are re-planted by the caller
export function hingeRot(rig, deg) { return new THREE.Quaternion().setFromAxisAngle(new V3(1, 0, 0), THREE.MathUtils.degToRad(deg)); }
export function hinge(rig, deg) {
  const hip = rig.rest.pelvis.p.clone();
  rig.setWQ('pelvis', hingeRot(rig, deg).multiply(rig.rest.pelvis.q.clone()));
}
