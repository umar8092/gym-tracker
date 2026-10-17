/* Gym machines (3D props + poses): chest press, lat pulldown, seated cable row, leg press, leg curl, cable pushdown.
   makeMachines(H) receives the shared helpers from exercises.js. Metres, +Y up, user faces +Z. */
import * as THREE from 'three';
import { MATS, makeBench, BENCH_TOP } from './props.js';
import { keyDir } from './poses.js';

const V3 = THREE.Vector3, DEG = Math.PI / 180;
const U3 = (x, y, z) => new V3(x, y, z).normalize();

/* ---- small builders ---- */
function bx(w, h, d, mat, x, y, z, parent) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; if (parent) { parent.add(m); } return m; }
function pad(w, h, d, x, y, z, parent) { const m = bx(w, h, d, MATS.padBlack, x, y, z, parent); return m; }
function between(a, b, r, mat, parent) {
  const g = new THREE.CylinderGeometry(r, r, 1, 14), m = new THREE.Mesh(g, mat); m.castShadow = true; setBetween(m, a, b); if (parent) { parent.add(m); } return m;
}
function setBetween(m, a, b) {
  const d = b.clone().sub(a), L = d.length() || 1e-4; m.position.copy(a).addScaledVector(d, 0.5); m.scale.set(1, L, 1); m.quaternion.setFromUnitVectors(new V3(0, 1, 0), d.normalize());
}
function cableLine() { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 1, 6), new THREE.MeshStandardMaterial({ color: 0x15191b, roughness: 0.6 })); m.castShadow = true; return m; }
function pulleyWheel(x, y, z, parent) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 24), MATS.steel); p.rotation.z = Math.PI / 2; p.position.set(x, y, z); parent.add(p); return p; }
// weight stack: guide rods + plates; the top `lifted` plates ride on the group returned as .lift
function weightStack(x, z, height = 1.45, lifted = 8) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const n = 18, th = height / (n + 2);
  bx(0.34, 0.04, 0.3, MATS.frame, 0, 0.02, 0, g);
  for (const sx of [-1, 1]) { const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, height + 0.1, 10), MATS.steel); rod.position.set(sx * 0.12, (height + 0.1) / 2, 0); g.add(rod); }
  const lift = new THREE.Group(); g.add(lift);
  for (let i = 0; i < n; i++) {
    const plate = bx(0.28, th * 0.86, 0.2, i < n - lifted ? MATS.plate : MATS.darkSteel, 0, 0.05 + th * (i + 0.5), 0, i < n - lifted ? g : lift);
  }
  bx(0.34, 0.05, 0.28, MATS.frame, 0, height + 0.07, 0, g);
  g.lift = lift; return g;
}

export function makeMachines(H) {
  const { placeInHand, gripFrame, wristFor, lieOnBench, legsOnFloor, Rx, Q, mir, lerp3 } = H;
  const cameraFor = (c) => Object.assign({ ty: 1.0, tz: 0, dist: 4.4, yaw: 40, pitch: 10 }, c || {});
  const neckLevel = (rig, deg) => { rig.turn('neck_01', new V3(1, 0, 0), -deg * 0.63); rig.turn('Head', new V3(1, 0, 0), -deg * 0.37); };
  const out = {};

  /* ---------------- chest press (seated, handles at chest height) ---------------- */
  out['machine-chest-press'] = (() => {
    const F = new V3(0, 0, 1), N = new V3(0, -1, 0), seatTop = 0.5;
    return {
      camera: cameraFor({ ty: 1.0, dist: 4.2, yaw: 40, pitch: 12 }),
      setup(ctx) {
        const g = new THREE.Group(); ctx.scene.add(g);
        for (const sx of [-1, 1]) { bx(0.07, 0.06, 1.7, MATS.frame, sx * 0.42, 0.03, -0.15, g); bx(0.06, 1.55, 0.08, MATS.frame, sx * 0.36, 0.8, -0.42, g); }
        bx(0.9, 0.06, 0.1, MATS.frame, 0, 0.03, 0.9, g); bx(0.9, 0.06, 0.1, MATS.frame, 0, 0.03, -0.9, g);
        pad(0.4, 0.09, 0.42, 0, seatTop - 0.045, 0.02, g); bx(0.1, 0.4, 0.1, MATS.frame, 0, 0.27, 0.0, g);
        const back = pad(0.36, 0.62, 0.09, 0, 0.88, -0.27, g); back.rotation.x = -8 * DEG;
        bx(0.5, 0.04, 0.04, MATS.frame, 0, 1.17, -0.38, g);
        const stack = weightStack(0, -0.85, 1.5); g.add(stack);
        const arms = [0, 1].map(() => { const a = new THREE.Group(); ctx.scene.add(a); return { tube: between(new V3(), new V3(0, 1, 0), 0.022, MATS.darkSteel, a), grip: new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.14, 14), MATS.steel) }; });
        arms.forEach(a => { a.grip.rotation.z = Math.PI / 2; a.grip.castShadow = true; ctx.scene.add(a.grip); });
        return { ctx, g, stack, arms };
      },
      pose(st, t) {
        const rig = st.ctx.rig; rig.reset();
        rig.setWP('pelvis', new V3(0, seatTop + 0.1, -0.06)); rig.setWQ('pelvis', Rx(-6).multiply(rig.rest.pelvis.q.clone()));
        legsOnFloor(rig, 0.2, 0.46, new V3(0.1, 1, 0.2)); neckLevel(rig, 4);
        const S = rig.wp('upperarm_l'), reach = rig.len.arm_l[0] + rig.len.arm_l[1];
        const zT = S.z + 0.3 + (reach * 0.96 + 0.07 - 0.3) * t, y = S.y - 0.02, G = new V3(0.22, y, zT);
        const pole = new V3(0.7, -0.55, -0.45), a = rig.armIK('l', wristFor(G, F, N), pole, F, N, 1), b = rig.armIK('r', wristFor(mir(G), F, N), mir(pole), F, N, 1);
        const piv = [new V3(0.5, 1.12, -0.34), new V3(-0.5, 1.12, -0.34)], hands = [G, mir(G)];
        st.arms.forEach((arm, i) => { setBetween(arm.tube, piv[i], hands[i]); arm.grip.position.copy(hands[i]); });
        st.stack.lift.position.y = 0.16 * t;
        return { grips: [G.clone(), mir(G)], diag: { reach: [a.reached, b.reached] } };
      }
    };
  })();

  /* ---------------- lat pulldown ---------------- */
  out['lat-pulldown'] = (() => {
    const halfW = 0.44, N = new V3(0, 0.2, 1), seatTop = 0.5, pulley = new V3(0, 2.3, 0.12);
    return {
      camera: cameraFor({ ty: 1.15, dist: 5.0, yaw: 38, pitch: 8 }),
      setup(ctx) {
        const g = new THREE.Group(); ctx.scene.add(g);
        for (const sx of [-1, 1]) { bx(0.07, 2.3, 0.07, MATS.frame, sx * 0.34, 1.15, 0.62, g); bx(0.07, 0.07, 0.95, MATS.frame, sx * 0.34, 2.3, 0.15, g); bx(0.07, 0.06, 1.6, MATS.frame, sx * 0.34, 0.03, -0.1, g); }
        bx(0.75, 0.06, 0.07, MATS.frame, 0, 2.3, 0.62, g);
        pad(0.4, 0.1, 0.4, 0, seatTop - 0.05, -0.18, g); bx(0.1, 0.4, 0.1, MATS.frame, 0, 0.26, -0.18, g);
        for (const sx of [-1, 1]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.16, 18), MATS.padBlack); r.rotation.z = Math.PI / 2; r.position.set(sx * 0.14, 0.78, 0.24); g.add(r); bx(0.04, 0.5, 0.04, MATS.frame, sx * 0.24, 0.55, 0.24, g); }
        pulleyWheel(0, pulley.y, pulley.z, g);
        const stack = weightStack(0, -0.75, 1.6); g.add(stack); bx(0.07, 0.07, 1.4, MATS.frame, 0, 2.3, -0.05, g);
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1.2, 16), MATS.steel); bar.rotation.z = Math.PI / 2; bar.castShadow = true; ctx.scene.add(bar);
        const cables = [cableLine(), cableLine(), cableLine()]; cables.forEach(c => ctx.scene.add(c));
        return { ctx, g, stack, bar, cables };
      },
      pose(st, t) {
        const rig = st.ctx.rig; rig.reset();
        rig.setWP('pelvis', new V3(0, seatTop + 0.1, -0.18)); rig.setWQ('pelvis', Rx(-(6 + 10 * t)).multiply(rig.rest.pelvis.q.clone()));
        legsOnFloor(rig, 0.2, 0.28, new V3(0.1, 1, 0.1)); neckLevel(rig, -6);
        const S = rig.wp('upperarm_l'), reach = rig.len.arm_l[0] + rig.len.arm_l[1];
        const top = new V3(halfW, S.y + 0.47, S.z + 0.12), low = new V3(halfW - 0.04, S.y - 0.06, S.z + 0.17), G = lerp3(top, low, t);
        const Fl = G.clone().sub(S).normalize(), Fr = mir(Fl), pole = new V3(0.55, -1, -0.25);
        const a = rig.armIK('l', wristFor(G, Fl, N), pole, Fl, N, 1), b = rig.armIK('r', wristFor(mir(G), Fr, mir(N)), mir(pole), Fr, mir(N), 1);
        st.bar.position.set(0, G.y, G.z); const e1 = new V3(0.55, G.y, G.z), e2 = new V3(-0.55, G.y, G.z);
        setBetween(st.cables[0], pulley, e1); setBetween(st.cables[1], pulley, e2); setBetween(st.cables[2], pulley, new V3(0, pulley.y + 0.06, pulley.z));
        st.stack.lift.position.y = 0.18 * (1 - t) * 0 + 0.2 * t;
        return { grips: [G.clone(), mir(G)], diag: { reach: [a.reached, b.reached] } };
      }
    };
  })();

  /* ---------------- seated cable row ---------------- */
  out['seated-cable-row'] = (() => {
    const seatTop = 0.46, lowP = new V3(0, 0.32, 1.25), N = new V3(-1, 0, 0), plateZ = 0.7;   // feet rest on the plate; ankles at plateZ - 0.08
    return {
      camera: cameraFor({ ty: 0.85, dist: 4.6, yaw: 75, pitch: 8 }),
      setup(ctx) {
        const g = new THREE.Group(); ctx.scene.add(g);
        bx(0.12, 0.08, 2.2, MATS.frame, 0, 0.04, 0.35, g); bx(0.5, 0.06, 0.1, MATS.frame, 0, 0.03, -0.55, g);
        pad(0.34, 0.1, 0.38, 0, seatTop - 0.05, -0.18, g); bx(0.08, 0.38, 0.08, MATS.frame, 0, 0.25, -0.18, g);
        const into = U3(0, -0.375, 0.927), pup = U3(0, 0.927, 0.375), A = new V3(0, 0.46, plateZ - 0.08);
        const fp = bx(0.5, 0.5, 0.04, MATS.frame, 0, 0, 0, g); fp.position.copy(A).addScaledVector(into, 0.105).addScaledVector(pup, 0.1);
        fp.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new V3(1, 0, 0), pup, into.clone().negate()));
        for (const sx of [-1, 1]) { bx(0.06, 0.45, 0.06, MATS.frame, sx * 0.2, 0.2, plateZ + 0.12, g); }
        bx(0.3, 0.9, 0.16, MATS.frame, 0, 0.45, 1.3, g);
        const stack = weightStack(0, 1.55, 1.2); g.add(stack); pulleyWheel(0, lowP.y, lowP.z, g);
        const handle = new THREE.Group(); for (const sx of [-1, 1]) { const h = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.12, 14), MATS.steel); h.position.set(sx * 0.07, 0, 0); h.rotation.x = Math.PI / 2; handle.add(h); }
        bx(0.18, 0.012, 0.012, MATS.steel, 0, 0, 0.06, handle); ctx.scene.add(handle);
        const cable = cableLine(); ctx.scene.add(cable);
        return { ctx, g, stack, handle, cable };
      },
      pose(st, t) {
        const rig = st.ctx.rig; rig.reset();
        rig.setWP('pelvis', new V3(0, seatTop + 0.1, -0.2 + 0.05 * (1 - t))); rig.setWQ('pelvis', Rx(14 * (1 - t) - 3 * t).multiply(rig.rest.pelvis.q.clone()));
        for (const s of ['l', 'r']) { const sg = s === 'l' ? 1 : -1; rig.legIK(s, new V3(sg * 0.15, 0.46, plateZ - 0.08), new V3(sg * 0.1, 1, 0.1)); rig.footFrame(s, new V3(0, 0.67, 0.745), new V3(0, 0.745, -0.67)); }
        neckLevel(rig, 2);
        const S = rig.wp('upperarm_l'), reach = rig.len.arm_l[0] + rig.len.arm_l[1];
        const G = lerp3(new V3(0.07, S.y - 0.3, S.z + reach * 0.93 + 0.06), new V3(0.07, S.y - 0.31, S.z + 0.19), t);
        const F = new V3(0, -0.05, 1);
        const a = rig.armIK('l', wristFor(G, F, N), new V3(0.5, 0.1, -1), F, N, 1), b = rig.armIK('r', wristFor(mir(G), F, mir(N)), new V3(-0.5, 0.1, -1), F, mir(N), 1);
        st.handle.position.set(0, G.y, G.z);
        setBetween(st.cable, G.clone().add(new V3(0, 0, 0.06)), lowP); st.stack.lift.position.y = 0.2 * (1 - t);
        return { grips: [new V3(0, G.y, G.z)], diag: { reach: [a.reached, b.reached] } };
      }
    };
  })();

  /* ---------------- leg press (45 degree sled) ---------------- */
  out['leg-press'] = (() => {
    const rail = U3(0, 1, 1), pu = U3(0, 1, -1), Hp = new V3(0, 0.62, -0.1);
    return {
      camera: cameraFor({ ty: 0.85, dist: 5.0, yaw: 80, pitch: 8 }),
      setup(ctx) {
        const g = new THREE.Group(); ctx.scene.add(g);
        for (const sx of [-1, 1]) { const r = between(new V3(sx * 0.4, 0.1, -0.5), new V3(sx * 0.4, 1.45, 0.85), 0.03, MATS.frame, g); bx(0.07, 0.06, 1.7, MATS.frame, sx * 0.42, 0.03, 0.1, g); }
        bx(0.9, 0.06, 0.08, MATS.frame, 0, 0.03, 0.9, g); bx(0.9, 0.06, 0.08, MATS.frame, 0, 0.03, -0.7, g);
        const seat = pad(0.42, 0.1, 0.4, 0, Hp.y - 0.12, Hp.z + 0.02, g);
        const back = pad(0.42, 0.7, 0.09, 0, 0, 0, g); back.position.copy(Hp).addScaledVector(pu, 0.36).addScaledVector(U3(0, 1, 1), -0.17).add(new V3(0, 0, 0)); back.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new V3(1, 0, 0), pu, U3(0, 1, 1)));
        for (const sx of [-1, 1]) { bx(0.04, 0.04, 0.3, MATS.frame, sx * 0.3, Hp.y + 0.12, Hp.z + 0.18, g); }
        const sled = new THREE.Group(); ctx.scene.add(sled);
        const plate = bx(0.7, 0.56, 0.05, MATS.frame, 0, 0, 0, sled); plate.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new V3(1, 0, 0), pu, rail));
        for (const sx of [-1, 1]) { const hn = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 12), MATS.steel); hn.rotation.z = Math.PI / 2; hn.position.set(sx * 0.62, -0.34, 0); sled.add(hn); for (let k = 0; k < 3; k++) { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.045, 32), MATS.plate); d.rotation.z = Math.PI / 2; d.position.set(sx * (0.5 + 0.05 * k), -0.34, 0); d.castShadow = true; sled.add(d); } }
        for (const sx of [-1, 1]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.5), MATS.frame); arm.position.set(sx * 0.4, 0, 0); arm.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new V3(1, 0, 0), pu, rail)); sled.add(arm); }
        return { ctx, g, sled };
      },
      pose(st, t) {
        const rig = st.ctx.rig; rig.reset();
        lieOnBench(rig, Hp, -45); neckLevel(rig, -2);
        for (const s of ['l', 'r']) { const sg = s === 'l' ? 1 : -1; rig.armIK(s, new V3(sg * 0.3, Hp.y + 0.2, Hp.z + 0.2), new V3(sg * 0.6, 0.2, -0.5), new V3(0, 0, 1), new V3(sg * -1, 0, 0), 0.9); }   // hands on the side handles
        const d = 0.54 + (0.84 - 0.54) * t, off = (s) => new V3(s * 0.17, 0, 0);
        const footDir = U3(0, 0.946, -0.326), footUp = rail.clone().negate();
        let ankleC = null;
        for (const s of ['l', 'r']) {
          const sg = s === 'l' ? 1 : -1, hip = rig.wp('thigh_' + s), A = hip.clone().addScaledVector(rail, d); A.x = sg * 0.17;
          rig.legIK(s, A, new V3(sg * 0.35, 0.3, -0.3).add(new V3(0, 0.7, 0)), footDir, footUp); ankleC = A;
        }
        const C = new V3(0, ankleC.y, ankleC.z).addScaledVector(rail, 0.125).addScaledVector(pu, 0.13); st.sled.position.copy(C);
        return { grips: [new V3(0.17, ankleC.y, ankleC.z)] };
      }
    };
  })();

  /* ---------------- leg curl (prone) ---------------- */
  out['leg-curl'] = (() => {
    const padTop = BENCH_TOP, bodyY = padTop + 0.12;
    const prone = (rig, dy = 0) => {
      const ex = new V3(-1, 0, 0), ey = new V3(0, 0, -1), ez = new V3(0, -1, 0);
      rig.setWP('pelvis', new V3(0, bodyY + dy, 0.05)); rig.setWQ('pelvis', new Q().setFromRotationMatrix(new THREE.Matrix4().makeBasis(ex, ey, ez)).multiply(rig.rest.pelvis.q.clone()));
    };
    return {
      camera: cameraFor({ ty: 0.6, dist: 4.0, yaw: 75, pitch: 14 }),
      setup(ctx) {
        const g = new THREE.Group(); ctx.scene.add(g);
        const rig0 = ctx.rig; rig0.reset(); prone(rig0, 0); ctx.root.updateMatrixWorld(true);
        const low = H.lowestPoint(ctx.body, v => Math.abs(v.x) < 0.2 && v.z < 0.45 && v.z > -0.5 && v.y < 0.9), dyBody = BENCH_TOP - low + 0.002;
        pad(0.34, 0.09, 1.15, 0, padTop - 0.045, -0.22, g); pad(0.3, 0.09, 0.3, 0, padTop - 0.12, 0.5, g).rotation.x = 16 * DEG;
        for (const sx of [-1, 1]) { bx(0.06, 0.45, 0.06, MATS.frame, sx * 0.14, 0.23, -0.6, g); bx(0.06, 0.45, 0.06, MATS.frame, sx * 0.14, 0.23, 0.2, g); bx(0.06, 0.06, 1.4, MATS.frame, sx * 0.34, 0.03, -0.1, g); }
        const stack = weightStack(0, 1.35, 1.2); g.add(stack);
        const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.34, 18), MATS.padBlack); roller.rotation.z = Math.PI / 2; ctx.scene.add(roller);
        const arm = between(new V3(), new V3(0, 1, 0), 0.025, MATS.darkSteel, ctx.scene);
        return { ctx, g, stack, roller, arm, dyBody };
      },
      pose(st, t) {
        const rig = st.ctx.rig; rig.reset(); prone(rig, st.dyBody);
        const kappa = (4 + 100 * t) * DEG;
        for (const s of ['l', 'r']) {
          const sg = s === 'l' ? -1 : 1, hip = rig.wp('thigh_' + s), knee = hip.clone().add(new V3(0, -0.01, 0.43)), A = knee.clone().add(new V3(0, 0.459 * Math.sin(kappa), 0.459 * Math.cos(kappa)));
          const calfDir = A.clone().sub(knee).normalize(), f = calfDir.clone().multiplyScalar(0.9).add(new V3(0, -0.4, 0)).normalize(), u = new V3(0, -1, 0).add(calfDir.clone().multiplyScalar(-0.2)).normalize();
          rig.legIK(s, A, new V3(0, -1, 0.1), f, u);
        }
        // hands on the front handles
        for (const s of ['l', 'r']) { const sg = s === 'l' ? 1 : -1; rig.armIK(s, new V3(sg * -0.3, padTop + 0.04, -0.75), new V3(sg * -0.5, 0.2, 0), new V3(0, 0, -1), new V3(0, -1, 0), 0.8); }
        neckLevel(rig, 20);
        const Al = rig.wp('foot_l').clone().add(rig.wp('foot_r')).multiplyScalar(0.5), knee = rig.wp('calf_l').clone(), cd = Al.clone().sub(knee).normalize();
        const cn = new V3(0, cd.z, -cd.y).normalize(), rp = Al.clone().addScaledVector(cn, 0.1).addScaledVector(cd, -0.03); st.roller.position.copy(rp);
        setBetween(st.arm, new V3(0, 0.3, 0.62), rp); st.stack.lift.position.y = 0.2 * t;
        return { grips: [new V3(0, Al.y, Al.z)] };
      }
    };
  })();

  /* ---------------- cable triceps pushdown ---------------- */
  out['cable-pushdown'] = (() => {
    const pulley = new V3(0, 2.1, 0.5), phi = [-14, 40, 90].map(d => d * DEG), keys = { U: [], F: [], N: [] };
    phi.forEach(p => { keys.U.push(U3(0.05, -1, 0.06)); keys.F.push(U3(0, -Math.sin(p), Math.cos(p))); keys.N.push(U3(0, -Math.cos(p), -Math.sin(p))); });
    return {
      camera: cameraFor({ ty: 1.1, dist: 4.8, yaw: 70, pitch: 8 }),
      setup(ctx) {
        const g = new THREE.Group(); ctx.scene.add(g);
        for (const sx of [-1, 1]) { bx(0.07, 2.3, 0.07, MATS.frame, sx * 0.36, 1.15, 0.62, g); bx(0.07, 0.06, 1.0, MATS.frame, sx * 0.36, 0.03, 0.9, g); bx(0.07, 0.07, 0.5, MATS.frame, sx * 0.36, 2.25, 0.4, g); }
        bx(0.8, 0.07, 0.07, MATS.frame, 0, 2.25, 0.62, g); pulleyWheel(0, pulley.y, pulley.z, g);
        const stack = weightStack(0, 1.1, 1.7); g.add(stack); bx(0.07, 0.07, 0.5, MATS.frame, 0, 2.25, 0.85, g);
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.3, 14), MATS.steel); bar.rotation.z = Math.PI / 2; bar.castShadow = true; ctx.scene.add(bar);
        const cable = cableLine(); ctx.scene.add(cable);
        return { ctx, g, stack, bar, cable };
      },
      pose(st, t) {
        const rig = st.ctx.rig; rig.reset(); neckLevel(rig, 0);
        const tt = 1 - 0 + t * 0, u = keyDir(keys.U, t), f = keyDir(keys.F, t), n = keyDir(keys.N, t), fr = {};
        for (const s of ['l', 'r']) { const m = s === 'l' ? x => x : mir; fr[s] = rig.armFK(s, m(u), m(f), m(n), 1); }
        const p = rig.wp('hand_l').clone().add(rig.wp('hand_r')).multiplyScalar(0.5).add(fr.l.f.clone().multiplyScalar(0.075)).add(fr.l.n.clone().multiplyScalar(0.035));
        st.bar.position.copy(p); setBetween(st.cable, pulley, p); st.stack.lift.position.y = 0.3 * t;
        return { grips: [p.clone()] };
      }
    };
  })();

  return out;
}
