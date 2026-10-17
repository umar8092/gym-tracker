/* Muscle highlighting on the 3D body. Each skin vertex gets a weight per muscle (computed once from the T-pose rest geometry),
   and a shader tints the vertices of the primary muscles red and the helping ones pink. IDs match the 2D diagram IDs. */
import * as THREE from 'three';
const V3 = THREE.Vector3;

export const MUSCLE_IDS = ['pec_up', 'pec_low', 'delt_ant', 'delt_lat', 'delt_post', 'biceps', 'triceps', 'forearm', 'trap_up', 'trap_mid',
  'trap_low', 'lats', 'back_low', 'abs', 'glute', 'quad', 'ham', 'calf', 'infra', 'teres'];
const IDX = Object.fromEntries(MUSCLE_IDS.map((m, i) => [m, i]));

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// soft ellipsoid around c (radii r), optionally only on surfaces facing dir
function ell(p, n, c, r, dir, thr = 0.15) {
  const d = ((p.x - c[0]) / r[0]) ** 2 + ((p.y - c[1]) / r[1]) ** 2 + ((p.z - c[2]) / r[2]) ** 2;
  let w = Math.max(0, 1 - d); w = Math.pow(w, 0.55);
  if (dir) { w *= sstep(thr - 0.2, thr + 0.25, n.x * dir[0] + n.y * dir[1] + n.z * dir[2]); }
  return w;
}
// soft window along a limb segment a->b between t0 and t1; facing = optional preferred surface direction
function limb(p, n, a, b, t0, t1, rad, dir, thr = 0.1) {
  const ab = b.clone().sub(a), L2 = ab.lengthSq(), t = p.clone().sub(a).dot(ab) / L2;
  const axis = a.clone().add(ab.clone().multiplyScalar(t)), off = p.clone().sub(axis), dist = off.length();
  let w = sstep(t0 - 0.06, t0 + 0.06, t) * (1 - sstep(t1 - 0.06, t1 + 0.06, t)) * (1 - sstep(rad * 0.9, rad * 1.5, dist));
  if (dir) { w *= sstep(thr - 0.25, thr + 0.3, off.clone().normalize().dot(new V3(dir[0], dir[1], dir[2]))); }
  return w;
}

/* weights for one vertex (world rest position p, normal n). Left side is evaluated, the right is the x-mirror. */
function weightsAt(p0, n0, B) {
  const out = new Float32Array(20), side = p0.x >= 0 ? 1 : -1;
  const p = new V3(Math.abs(p0.x), p0.y, p0.z), n = new V3(n0.x * side, n0.y, n0.z);
  const S = B.shoulder, E = B.elbow, W = B.wrist, K = B.knee, A = B.ankle, H = B.hip;
  const set = (id, w) => { out[IDX[id]] = Math.max(out[IDX[id]], w); };

  // torso only where the point is inside the trunk (not on the arm)
  const torso = 1 - sstep(0.15, 0.2, p.x - Math.max(0, (p.y - 1.30) * 0.5));
  const front = [0, 0.1, 1], back = [0, 0.1, -1];
  set('pec_up', ell(p, n, [0.09, 1.395, 0.07], [0.115, 0.06, 0.12], front) * torso);
  set('pec_low', ell(p, n, [0.09, 1.31, 0.07], [0.115, 0.065, 0.12], front) * torso);
  set('abs', ell(p, n, [0.04, 1.12, 0.09], [0.1, 0.17, 0.08], front) * torso);
  set('trap_up', ell(p, n, [0.08, 1.50, -0.1], [0.115, 0.075, 0.1], [0, 0.55, -0.8], 0.0));
  set('trap_mid', ell(p, n, [0.06, 1.385, -0.125], [0.1, 0.06, 0.06], back) * torso);
  set('trap_low', ell(p, n, [0.04, 1.255, -0.125], [0.085, 0.075, 0.06], back) * torso);
  set('lats', ell(p, n, [0.14, 1.235, -0.1], [0.1, 0.15, 0.1], [0.45, 0, -0.9], 0.0) * torso);
  set('back_low', ell(p, n, [0.055, 1.11, -0.125], [0.07, 0.13, 0.06], back) * torso);
  set('infra', ell(p, n, [0.14, 1.375, -0.13], [0.07, 0.05, 0.05], back) * torso);
  set('teres', ell(p, n, [0.17, 1.32, -0.12], [0.05, 0.035, 0.05], back) * torso);
  set('glute', ell(p, n, [0.09, 0.925, -0.115], [0.1, 0.085, 0.075], back));

  // shoulder cap split into three heads, then arm muscles along the segments
  const dS = p.clone().sub(S), dl = dS.length(), inCap = 1 - sstep(0.1, 0.15, dl);
  const dn = dS.clone().divideScalar(dl || 1), onArmSide = sstep(-0.35, 0.05, dn.x);
  const ant = sstep(0.0, 0.5, dn.z) * inCap * onArmSide, post = sstep(0.0, 0.5, -dn.z - 0.12) * inCap * onArmSide;
  const lat = sstep(0.15, 0.6, dn.y) * (1 - ant * 0.8) * (1 - post * 0.8) * inCap * onArmSide;
  set('delt_ant', ant); set('delt_post', post); set('delt_lat', lat);
  const dArm = [0, -0.25, 1];
  set('delt_ant', limb(p, n, S, E, 0.0, 0.42, 0.085, dArm, 0.35) * 0.8);
  set('delt_post', limb(p, n, S, E, 0.0, 0.42, 0.085, [0, 0.15, -1], 0.5) * 0.8);
  set('delt_lat', limb(p, n, S, E, 0.0, 0.4, 0.085, [0, 1, 0], 0.55) * 0.8);
  set('biceps', limb(p, n, S, E, 0.3, 0.93, 0.07, dArm, 0.2));
  set('triceps', limb(p, n, S, E, 0.25, 0.95, 0.07, [0, 0.25, -1], 0.2));
  set('forearm', limb(p, n, E, W, 0.04, 0.9, 0.06, null));

  // legs
  set('quad', limb(p, n, H, K, 0.06, 0.93, 0.125, [0, 0, 1], 0.1));
  set('ham', limb(p, n, H, K, 0.12, 0.93, 0.125, [0, 0, -1], 0.1));
  set('calf', limb(p, n, K, A, 0.04, 0.7, 0.1, [0, 0, -1], 0.0));
  return out;
}

/* Compute and attach the weights to the body geometry (call once, before cloning). */
export function bakeMuscles(rig, bodyMesh) {
  bodyMesh.updateMatrixWorld(true);
  const g = bodyMesh.geometry, pos = g.attributes.position, nor = g.attributes.normal, N = pos.count;
  const B = { shoulder: rig.rest.upperarm_l.p.clone(), elbow: rig.rest.lowerarm_l.p.clone(), wrist: rig.rest.hand_l.p.clone(),
    hip: rig.rest.thigh_l.p.clone(), knee: rig.rest.calf_l.p.clone(), ankle: rig.rest.foot_l.p.clone() };
  const arr = [0, 1, 2, 3, 4].map(() => new Float32Array(N * 4)), v = new V3(), nv = new V3(), nm = new THREE.Matrix3().getNormalMatrix(bodyMesh.matrixWorld);
  for (let i = 0; i < N; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(bodyMesh.matrixWorld); nv.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize();
    const w = weightsAt(v, nv, B);
    for (let k = 0; k < 20; k++) { arr[k >> 2][i * 4 + (k & 3)] = w[k]; }
  }
  ['mA', 'mB', 'mC', 'mD', 'mE'].forEach((name, k) => g.setAttribute(name, new THREE.BufferAttribute(arr[k], 4)));
}

const RED = new THREE.Color('#cf2a20'), PINK = new THREE.Color('#ef9a92');
/* Give this figure its own copy of the skin material with the highlight shader. Returns {set(primary[], secondary[]), setDebug(on)}. */
export function muscleMaterial(mesh) {
  const mat = mesh.material.clone(); mesh.material = mat;
  const u = { uP: { value: [0, 1, 2, 3, 4].map(() => new THREE.Vector4()) }, uS: { value: [0, 1, 2, 3, 4].map(() => new THREE.Vector4()) },
    uRed: { value: RED.clone() }, uPink: { value: PINK.clone() }, uDebug: { value: 0 } };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 mA; attribute vec4 mB; attribute vec4 mC; attribute vec4 mD; attribute vec4 mE;\nvarying vec4 vA; varying vec4 vB; varying vec4 vC; varying vec4 vD; varying vec4 vE;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvA = mA; vB = mB; vC = mC; vD = mD; vE = mE;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec4 vA; varying vec4 vB; varying vec4 vC; varying vec4 vD; varying vec4 vE;\nuniform vec4 uP[5]; uniform vec4 uS[5]; uniform vec3 uRed; uniform vec3 uPink; uniform float uDebug;\n' +
        'vec3 hue(float h){ return clamp(abs(mod(h*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0,0.0,1.0); }')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float wp = dot(vA,uP[0])+dot(vB,uP[1])+dot(vC,uP[2])+dot(vD,uP[3])+dot(vE,uP[4]);
        float ws = dot(vA,uS[0])+dot(vB,uS[1])+dot(vC,uS[2])+dot(vD,uS[3])+dot(vE,uS[4]);
        wp = smoothstep(0.12, 0.5, clamp(wp, 0.0, 1.0)); ws = smoothstep(0.12, 0.5, clamp(ws, 0.0, 1.0)) * (1.0 - wp);
        if (uDebug > 0.5) {
          vec4 a[5]; a[0]=vA; a[1]=vB; a[2]=vC; a[3]=vD; a[4]=vE; float best=0.0; float id=0.0;
          for (int i=0;i<5;i++){ for (int k=0;k<4;k++){ float w=a[i][k]; if (w>best){best=w; id=float(i*4+k);} } }
          diffuseColor.rgb = mix(diffuseColor.rgb, hue(id/20.0), clamp(best*1.4,0.0,0.9));
        } else {
          diffuseColor.rgb = mix(diffuseColor.rgb, uRed * 0.9, wp * 0.92);
          diffuseColor.rgb = mix(diffuseColor.rgb, uPink, ws * 0.72);
        }`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uRed * wp * 0.1;');
  };
  mat.needsUpdate = true;
  return {
    set(primary, secondary) {
      const P = new Float32Array(20), S = new Float32Array(20);
      (primary || []).forEach(id => { if (id in IDX) { P[IDX[id]] = 1; } });
      (secondary || []).forEach(id => { if (id in IDX) { S[IDX[id]] = 1; } });
      for (let k = 0; k < 5; k++) { u.uP.value[k].fromArray(P, k * 4); u.uS.value[k].fromArray(S, k * 4); }
    },
    setDebug(on) { u.uDebug.value = on ? 1 : 0; }
  };
}
