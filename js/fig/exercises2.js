/* Free-weight exercises for back, legs and arms. makeMore(H) receives the shared helpers from exercises.js (avoids a circular import). */
import * as THREE from 'three';
import { makeDumbbell, makeBarbell, makeBench, MATS, BENCH_TOP } from './props.js';
import { keyDir, vslerp } from './poses.js';

const V3 = THREE.Vector3, DEG = Math.PI / 180;
const U3 = (x, y, z) => new V3(x, y, z).normalize();

export function makeMore(H) {
  const { placeInHand, gripFrame, wristFor, lieOnBench, lowestPoint, surfaceAlong, legsOnFloor, Rx, Q, mir, lerp3, pressExercise } = H;
  const cameraFor = (c) => Object.assign({ ty: 0.95, tz: 0, dist: 4.2, yaw: 35, pitch: 11 }, c || {});
  const out = {};

  // both hands on a bar: grip centre G (left hand at +x), frames for the left hand, mirrored for the right
  function gripBar(rig, bar, G, halfW, F, N, pole, curl = 1) {
    const gl = new V3(halfW, G.y, G.z), gr = new V3(-halfW, G.y, G.z);
    const a = rig.armIK('l', wristFor(gl, F, N), pole, F, N, curl), b = rig.armIK('r', wristFor(gr, mir(F), mir(N)), mir(pole), mir(F), mir(N), curl);
    if (bar) { bar.position.copy(G); bar.rotation.set(0, 0, 0); }
    return { a, b, gl, gr };
  }
  const neckLevel = (rig, deg) => { rig.turn('neck_01', new V3(1, 0, 0), -deg * 0.63); rig.turn('Head', new V3(1, 0, 0), -deg * 0.37); };

  /* ---------------- BACK ---------------- */
  // Barbell bent-over row. t = 0 bar hanging at arm's length, t = 1 bar touching the lower ribs.
  out['barbell-row'] = (() => {
    const hinge = 52, F = new V3(0, -1, -0.12), N = new V3(0, -0.12, -1), halfW = 0.26;
    const pose = (rig) => {
      rig.setWP('pelvis', rig.rest.pelvis.p.clone().add(new V3(0, -0.07, -0.19)));
      rig.setWQ('pelvis', Rx(hinge).multiply(rig.rest.pelvis.q.clone()));
      legsOnFloor(rig, 0.15, rig.rest.foot_l.p.z, new V3(0.1, 0.4, 1)); neckLevel(rig, 40);
    };
    return {
      camera: cameraFor({ ty: 0.95, dist: 4.0, yaw: 62, pitch: 10 }),
      setup(ctx) {
        const bar = makeBarbell([20, 10]); ctx.scene.add(bar); const rig = ctx.rig; rig.reset(); pose(rig); ctx.root.updateMatrixWorld(true);
        const S = rig.wp('upperarm_l'), P = rig.wp('pelvis'), Sm = new V3(0, S.y, S.z), nF = new V3(0, -Math.sin(hinge * DEG), Math.cos(hinge * DEG));
        const C = P.clone().lerp(Sm, 0.62); const top = C.clone().addScaledVector(nF, surfaceAlong(ctx.body, C, nF, 0.05) + 0.0145 + 0.01);
        return { ctx, bar, top };
      },
      pose(st, t) {
        const rig = st.ctx.rig; rig.reset(); pose(rig);
        const S = rig.wp('upperarm_l'), reach = rig.len.arm_l[0] + rig.len.arm_l[1], g = gripFrame(F, N), off = g.f.clone().multiplyScalar(0.075).add(g.n.clone().multiplyScalar(0.035));
        const lo = new V3(halfW, S.y - reach * 0.975 + off.y, S.z + off.z);
        const G = lerp3(new V3(0, lo.y, lo.z), st.top, t);
        const r = gripBar(rig, st.bar, G, halfW, F, N, new V3(0.45, 0.5, -1));
        return { grips: [G.clone()], diag: { reach: [r.a.reached, r.b.reached] } };
      }
    };
  })();

  /* ---------------- LEGS ---------------- */
  // Back squat. t = 0 bottom (thighs at least parallel), t = 1 standing.
  out['barbell-squat'] = (() => {
    const F = new V3(0.2, 1, 0.1), N = new V3(0, -0.35, 0.94), halfW = 0.4;
    const pose = (rig, t) => {
      const e = t, hing = 38 * (1 - Math.pow(t, 1.4)), aZ = rig.rest.foot_l.p.z;
      const hipY = 0.455 + (rig.rest.pelvis.p.y - 0.455) * e, hipZ = aZ + (-0.2 + (rig.rest.pelvis.p.z - aZ + 0.2) * Math.pow(e, 1.1));
      rig.setWP('pelvis', new V3(0, hipY, hipZ));
      rig.setWQ('pelvis', Rx(hing).multiply(rig.rest.pelvis.q.clone()));
      for (const s of ['l', 'r']) { const sg = s === 'l' ? 1 : -1; rig.legIK(s, new V3(sg * 0.17, rig.rest['foot_' + s].p.y, aZ), new V3(sg * 0.5, 0.1, 1)); rig.flatFoot(s, 18); }
      neckLevel(rig, 12 + hing * 0.3);
    };
    return {
      camera: cameraFor({ ty: 0.85, dist: 4.4, yaw: 62, pitch: 8 }),
      setup(ctx) {
        const bar = makeBarbell([20, 20, 10]); ctx.scene.add(bar); const rig = ctx.rig; rig.reset(); pose(rig, 1); ctx.root.updateMatrixWorld(true);
        const nB = new V3(0, 0.55, -0.83), C = rig.wp('spine_03').clone().add(new V3(0, 0.15, 0));
        const d = surfaceAlong(ctx.body, C, nB, 0.05);
        return { ctx, bar, rel: C.clone().addScaledVector(nB, d + 0.0145).sub(rig.wp('neck_01')), neckRest: rig.wp('neck_01').clone() };
      },
      pose(st, t) {
        const rig = st.ctx.rig; rig.reset(); pose(rig, t);
        const G = rig.wp('neck_01').clone().add(st.rel);     // bar rides on the upper back; offset measured in the standing pose, follows the torso
        const r = gripBar(rig, st.bar, G.clone().setX(0), halfW, F, N, new V3(0.25, -1, -0.3));
        return { grips: [G.clone().setX(0)], diag: { reach: [r.a.reached, r.b.reached] } };
      }
    };
  })();

  // Romanian deadlift. t = 0 bar below the knees with a flat back hinged forward, t = 1 standing tall.
  out['romanian-deadlift'] = (() => {
    const F = new V3(0, -1, -0.05), N = new V3(0, -0.05, -1), halfW = 0.25;
    const pose = (rig, t) => {
      const h = 76 * (1 - t);
      rig.setWP('pelvis', rig.rest.pelvis.p.clone().add(new V3(0, -0.01 * (1 - t), -0.2 * (1 - t))));
      rig.setWQ('pelvis', Rx(h).multiply(rig.rest.pelvis.q.clone()));
      for (const s of ['l', 'r']) { const sg = s === 'l' ? 1 : -1; rig.legIK(s, new V3(sg * 0.14, rig.rest['foot_' + s].p.y, rig.rest.foot_l.p.z), new V3(0, 0.1, 1)); rig.flatFoot(s, 8); }
      neckLevel(rig, h * 0.75);
    };
    return {
      camera: cameraFor({ ty: 0.85, dist: 4.2, yaw: 62, pitch: 8 }),
      setup(ctx) { const bar = makeBarbell([20, 20]); ctx.scene.add(bar); return { ctx, bar }; },
      pose(st, t) {
        const rig = st.ctx.rig; rig.reset(); pose(rig, t);
        const S = rig.wp('upperarm_l'), reach = rig.len.arm_l[0] + rig.len.arm_l[1], g = gripFrame(F, N), off = g.f.clone().multiplyScalar(0.075).add(g.n.clone().multiplyScalar(0.035));
        const G = new V3(0, S.y - reach * 0.975 + off.y, S.z + off.z);
        const r = gripBar(rig, st.bar, G, halfW, F, N, new V3(0.3, 0.2, -1));
        return { grips: [G.clone()], diag: { reach: [r.a.reached, r.b.reached] } };
      }
    };
  })();

  // Dumbbell split squat / lunge. t = 0 bottom (rear knee just above the floor), t = 1 standing tall in the split stance.
  out['dumbbell-walking-lunge'] = (() => {
    const L = 0.4;
    const pose = (rig, t) => {
      const hipY = 0.52 + (0.855 - 0.52) * t;
      rig.setWP('pelvis', new V3(0, hipY, -0.02)); rig.setWQ('pelvis', rig.rest.pelvis.q.clone());
      rig.legIK('l', new V3(0.1, rig.rest.foot_l.p.y, L), new V3(0.1, 0.5, 1)); rig.flatFoot('l', 6);                                  // front foot flat
      rig.legIK('r', new V3(-0.1, 0.165, -L), new V3(-0.1, -1, 0.15), new V3(0, -0.8, 0.6), new V3(0, 0.6, 0.8));                     // rear foot on its toes
      neckLevel(rig, 0);
    };
    return {
      camera: cameraFor({ ty: 0.9, dist: 4.6, yaw: 75, pitch: 8 }),
      setup(ctx) { const db = [makeDumbbell(), makeDumbbell()]; db.forEach(d => ctx.scene.add(d)); return { ctx, db }; },
      pose(st, t) {
        const rig = st.ctx.rig; rig.reset(); pose(rig, t);
        const fr = {}; for (const s of ['l', 'r']) { const m = s === 'l' ? 1 : -1; fr[s] = rig.armFK(s, new V3(0.075 * m, -1, 0.02), new V3(0.02 * m, -1, 0.05), new V3(-m, 0, 0), 1); }
        placeInHand(rig, st.db[0], 'l', fr.l); placeInHand(rig, st.db[1], 'r', fr.r);
        return { grips: [st.db[0].position.clone().setX(0), st.db[1].position.clone().setX(0)].slice(0, 1) };
      }
    };
  })();

  // Standing calf raise with dumbbells, balls of the feet on a step. t = 0 heels low (stretch), t = 1 up on the toes.
  out['dumbbell-calf-raise'] = (() => {
    const stepH = 0.1, ballZ = 0.02, ballY = stepH + 0.03;
    const pose = (rig, t) => {
      const psi = (24 + 48 * t) * DEG, fl = 0.16;                                     // ankle->ball pitch below horizontal
      const ankle = new V3(0, ballY + fl * Math.sin(psi), ballZ - fl * Math.cos(psi));
      rig.setWP('pelvis', rig.rest.pelvis.p.clone().add(new V3(0, ankle.y - rig.rest.foot_l.p.y, ankle.z - rig.rest.foot_l.p.z)));
      rig.setWQ('pelvis', rig.rest.pelvis.q.clone());
      for (const s of ['l', 'r']) { const sg = s === 'l' ? 1 : -1; rig.legIK(s, ankle.clone().setX(sg * 0.12), new V3(0, 0, 1), new V3(0, -Math.sin(psi), Math.cos(psi)), new V3(0, Math.cos(psi), Math.sin(psi))); }
    };
    return {
      camera: cameraFor({ ty: 0.9, dist: 4.4, yaw: 62, pitch: 8 }),
      setup(ctx) {
        const db = [makeDumbbell(), makeDumbbell()]; db.forEach(d => ctx.scene.add(d));
        const step = new THREE.Mesh(new THREE.BoxGeometry(0.5, stepH, 0.34), MATS.frame); step.position.set(0, stepH / 2, ballZ + 0.14); step.castShadow = step.receiveShadow = true; ctx.scene.add(step);
        return { ctx, db, step };
      },
      pose(st, t) {
        const rig = st.ctx.rig; rig.reset(); pose(rig, t);
        const fr = {}; for (const s of ['l', 'r']) { const m = s === 'l' ? 1 : -1; fr[s] = rig.armFK(s, new V3(0.075 * m, -1, 0.02), new V3(0.02 * m, -1, 0.05), new V3(-m, 0, 0), 1); }
        placeInHand(rig, st.db[0], 'l', fr.l); placeInHand(rig, st.db[1], 'r', fr.r);
        return { grips: [rig.wp('foot_l').clone().add(new V3(0, 0.0, 0.0))].slice(0, 0).concat([st.db[0].position.clone()]) };
      }
    };
  })();

  // Pull-up. t = 0 dead hang, t = 1 chin over the bar.
  out['pull-up'] = (() => {
    const barY = 2.2, halfW = 0.36, F = new V3(0, 1, 0.1), N = new V3(0, 0.15, 1);
    return {
      camera: cameraFor({ ty: 1.45, dist: 5.2, yaw: 25, pitch: 6 }),
      setup(ctx) {
        const g = new THREE.Group();
        for (const sx of [-1, 1]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.4, 16), MATS.frame); post.position.set(sx * 0.75, 1.2, 0); post.castShadow = true; g.add(post); const foot = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.9), MATS.frame); foot.position.set(sx * 0.75, 0.02, 0); g.add(foot); }
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.6, 20), MATS.steel); bar.rotation.z = Math.PI / 2; bar.position.set(0, barY, 0); bar.castShadow = true; g.add(bar);
        ctx.scene.add(g); return { ctx, g };
      },
      pose(st, t) {
        const rig = st.ctx.rig; rig.reset();
        const py = 1.085 + (1.5 - 1.085) * t, lean = 6 * (1 - t) + 14 * t;
        rig.setWP('pelvis', new V3(0, py, -0.02 - 0.05 * t)); rig.setWQ('pelvis', Rx(-lean * 0.5).multiply(rig.rest.pelvis.q.clone()));
        for (const s of ['l', 'r']) {   // knees bent, feet behind
          const sg = s === 'l' ? 1 : -1, hip = rig.wp('thigh_' + s);
          rig.legIK(s, hip.clone().add(new V3(-sg * 0.01, -0.36, -0.4)), new V3(0, -0.4, 1)); rig.relaxFoot(s, 22);
        }
        neckLevel(rig, -10 * t + 8);
        const gl = new V3(halfW, barY, 0), gr = new V3(-halfW, barY, 0), pole = new V3(0.5, -1, 0.1);
        const a = rig.armIK('l', wristFor(gl, F, N), pole, F, N, 1), b = rig.armIK('r', wristFor(gr, mir(F), mir(N)), mir(pole), mir(F), mir(N), 1);
        return { grips: [rig.wp('spine_03').clone().setX(0)], diag: { reach: [a.reached, b.reached] } };
      }
    };
  })();

  // One-arm dumbbell row, left hand and knee on a bench. t = 0 dumbbell hanging, t = 1 pulled to the hip.
  out['one-arm-dumbbell-row'] = (() => {
    const hinge = 84, bx = 0.32;
    return {
      camera: cameraFor({ ty: 0.8, dist: 4.0, yaw: 100, pitch: 14 }),
      setup(ctx) {
        const bench = makeBench(0); bench.rotation.y = Math.PI; bench.position.set(bx, 0, 0); ctx.scene.add(bench);
        const db = makeDumbbell(); ctx.scene.add(db); return { ctx, bench, db };
      },
      pose(st, t) {
        const rig = st.ctx.rig; rig.reset();
        rig.setWP('pelvis', new V3(0.1, 0.935, -0.02)); rig.setWQ('pelvis', Rx(hinge).multiply(rig.rest.pelvis.q.clone()));
        rig.aim('thigh_l', new V3(0.1, -1, 0.12)); rig.aim('calf_l', new V3(0, 0.03, -1)); rig.relaxFoot('l', 38); rig.legIK('r', new V3(-0.2, rig.rest.foot_r.p.y, -0.12), new V3(-0.2, 0.2, 1)); rig.flatFoot('r', 10);
        neckLevel(rig, 45);
        const a = rig.armIK('l', new V3(bx, BENCH_TOP + 0.095, 0.36), new V3(0.4, 0.2, -0.3), new V3(0, 0, 1), new V3(0, -1, 0), 0.3);
        const S = rig.wp('upperarm_r'), reach = rig.len.arm_r[0] + rig.len.arm_r[1];
        const hang = new V3(S.x - 0.02, S.y - reach * 0.97, S.z), pull = new V3(S.x - 0.04, S.y - 0.2, S.z - 0.28);
        const G = lerp3(hang, pull, t), F = new V3(0, -1, 0.1), N = new V3(1, 0, 0);
        const b = rig.armIK('r', G, new V3(-0.2, 0.3, -1), F, N, 1);
        placeInHand(rig, st.db, 'r', b.frame);
        return { grips: [st.db.position.clone()], diag: { reach: [a.reached, b.reached] } };
      }
    };
  })();

  /* ---------------- ARMS ---------------- */
  // Standing curls from direction keys. bar: true = barbell between the hands, false = dumbbells (hammer = neutral grip).
  function curl(o) {
    const beta = [0, 80, 138].map(d => d * DEG), keys = { U: [], F: [], N: [] };
    beta.forEach((b, i) => {
      keys.U.push(U3(0.075, -1, i === 2 ? 0.22 : 0.02));
      keys.F.push(U3(0, -Math.cos(b), Math.sin(b)));
      keys.N.push(o.hammer ? U3(-1, 0, 0) : U3(0, Math.sin(b), Math.cos(b)));
    });
    return {
      camera: cameraFor({ ty: 1.15, dist: 3.2, yaw: 60, pitch: 8 }),
      setup(ctx) { const hold = o.bar ? makeBarbell([10]) : [makeDumbbell(), makeDumbbell()]; (o.bar ? [hold] : hold).forEach(h => ctx.scene.add(h)); return { ctx, hold }; },
      pose(st, t) {
        const rig = st.ctx.rig; rig.reset();
        const u = keyDir(keys.U, t), f = keyDir(keys.F, t), n = keyDir(keys.N, t), fr = {};
        for (const s of ['l', 'r']) { const m = s === 'l' ? x => x : mir; fr[s] = rig.armFK(s, m(u), m(f), m(n), 1); }
        if (o.bar) { const p = rig.wp('hand_l').clone().add(rig.wp('hand_r')).multiplyScalar(0.5).add(fr.l.f.clone().multiplyScalar(0.075)).add(fr.l.n.clone().multiplyScalar(0.035)); st.hold.position.copy(p); st.hold.rotation.set(0, 0, 0); }
        else { placeInHand(rig, st.hold[0], 'l', fr.l); placeInHand(rig, st.hold[1], 'r', fr.r); }
        return { grips: o.bar ? [st.hold.position.clone()] : [st.hold[0].position.clone(), st.hold[1].position.clone()] };
      }
    };
  }
  out['barbell-curl'] = curl({ bar: true });
  out['hammer-curl'] = curl({ hammer: true });

  // Close-grip bench press: the bench press with hands about shoulder width and elbows tucked.
  out['close-grip-bench'] = pressExercise({ bar: true, halfW: 0.2, topSpread: 1.0, pole: new V3(0.25, -1, 0.1), bottomZ: 0.15 });

  // Overhead dumbbell triceps extension (both hands on one dumbbell). t = 0 forearms folded behind the head, t = 1 arms extended overhead.
  out['overhead-triceps-extension'] = (() => {
    const keys = { U: [U3(0.07, 1, -0.06), U3(-0.1, 1, -0.04), U3(-0.22, 1, -0.02)], F: [U3(0, -0.45, -0.89), U3(-0.2, 0.3, -0.95), U3(-0.22, 1, -0.05)], N: [U3(0, 0.9, 0.4), U3(0, 0.3, 0.95), U3(0, -0.05, 1)] };
    return {
      camera: cameraFor({ ty: 1.35, dist: 3.4, yaw: 75, pitch: 8 }),
      setup(ctx) { const db = makeDumbbell(0.07); ctx.scene.add(db); return { ctx, db }; },
      pose(st, t) {
        const rig = st.ctx.rig; rig.reset(); neckLevel(rig, 0);
        const u = keyDir(keys.U, t), f = keyDir(keys.F, t), n = keyDir(keys.N, t), fr = {};
        // both hands cup under the top plate: fingers point inward toward each other, palms up
        for (const s of ['l', 'r']) { const m = s === 'l' ? x => x : mir; rig.aim('upperarm_' + s, m(u)); rig.aim('lowerarm_' + s, m(f)); fr[s] = rig.handFrame(s, m(f).add(new V3(s === 'l' ? -0.9 : 0.9, 0, 0)), new V3(0, 1, 0), 0.7); }
        const mid = rig.wp('hand_l').clone().add(rig.wp('hand_r')).multiplyScalar(0.5).add(new V3(0, 0.02, 0));
        st.db.position.copy(mid).add(new V3(0, -0.085, 0)); st.db.rotation.set(0, 0, Math.PI / 2);   // dumbbell hangs from the cupped hands
        return { grips: [mid.clone()] };
      }
    };
  })();

  // Lying triceps extension (skull crusher) with a barbell. t = 0 bar lowered toward the forehead, t = 1 arms straight above the shoulders.
  out['lying-triceps-extension'] = (() => {
    const base = pressExercise({ bar: true, halfW: 0.2 });
    const g = [0, 55, 100].map(d => d * DEG), keys = { U: [], F: [], N: [] };
    g.slice().reverse().forEach(gm => { keys.U.push(U3(0.05, Math.cos(10 * DEG), -Math.sin(10 * DEG))); keys.F.push(U3(0, Math.cos(gm), -Math.sin(gm))); keys.N.push(U3(0, Math.sin(gm), Math.cos(gm))); });
    return Object.assign({}, base, {
      pose(st, t) {
        const rig = st.ctx.rig; rig.reset(); lieOnBench(rig, new V3(0, 0.6 + st.dy, 0.12), -90); legsOnFloor(rig);
        const u = keyDir(keys.U, t), f = keyDir(keys.F, t), n = keyDir(keys.N, t), fr = {};
        for (const s of ['l', 'r']) { const m = s === 'l' ? x => x : mir; fr[s] = rig.armFK(s, m(u), m(f), m(n), 1); }
        const p = rig.wp('hand_l').clone().add(rig.wp('hand_r')).multiplyScalar(0.5).add(fr.l.f.clone().multiplyScalar(0.075)).add(fr.l.n.clone().multiplyScalar(0.035));
        st.hold.position.copy(p); st.hold.rotation.set(0, 0, 0);
        return { grips: [p.clone()] };
      }
    });
  })();

  return out;
}
