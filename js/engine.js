/* 3D figure engine, ported unchanged from the shoulder-day prototype (custom canvas renderer, no dependencies).
   Public API at the bottom: Engine.mount(root, exercise), Engine.unmountAll(). */
(function () {
  var DEG = Math.PI / 180;

  /* =========================================================
     Tiny vector helpers
     ========================================================= */
  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function mul(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function len3(a) { return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]); }
  function norm(a) { var l = len3(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  function clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }
  function slerp(a, b, t) {
    var d = clamp(dot(a, b), -1, 1), w = Math.acos(d);
    if (w < 1e-4) { return a; }
    var s = Math.sin(w), k0 = Math.sin((1 - t) * w) / s, k1 = Math.sin(t * w) / s;
    return [a[0] * k0 + b[0] * k1, a[1] * k0 + b[1] * k1, a[2] * k0 + b[2] * k1];
  }
  function ease(x) { return 0.5 - 0.5 * Math.cos(Math.PI * x); }
  // rotate point p about an axis parallel to X passing through pivot
  function rotX(p, piv, ang) {
    var c = Math.cos(ang), s = Math.sin(ang), dy = p[1] - piv[1], dz = p[2] - piv[2];
    return [p[0], piv[1] + dy * c - dz * s, piv[2] + dy * s + dz * c];
  }

  /* =========================================================
     Mesh builder (low-poly body made from capsules, lofts, ellipsoids)
     ========================================================= */
  var G = { v: [], n: [], t: [], c: [], bz: [] };
  var curBias = 0;
  function bias(v) { curBias = v; }
  function reset() { G.v.length = 0; G.n.length = 0; G.t.length = 0; G.c.length = 0; G.bz.length = 0; curBias = 0; }
  function pushV(p, n, tf) {
    var i = G.v.length / 3;
    if (tf) {
      var q = tf(p), q2 = tf([p[0] + n[0], p[1] + n[1], p[2] + n[2]]);
      G.v.push(q[0], q[1], q[2]);
      G.n.push(q2[0] - q[0], q2[1] - q[1], q2[2] - q[2]);
    } else {
      G.v.push(p[0], p[1], p[2]);
      G.n.push(n[0], n[1], n[2]);
    }
    return i;
  }
  // rows x segs grid, wrapped around the segs direction
  function grid(R, S, fn, col, tf, open) {
    var base = G.v.length / 3, i, j;
    for (i = 0; i < R; i++) {
      for (j = 0; j < S; j++) { var r = fn(i, j); pushV(r[0], r[1], tf); }
    }
    for (i = 0; i < R - 1; i++) {
      for (j = 0; j < (open ? S - 1 : S); j++) {
        var j2 = (j + 1) % S;
        var a = base + i * S + j, b = base + i * S + j2, c = base + (i + 1) * S + j, d = base + (i + 1) * S + j2;
        G.t.push(a, b, c, b, d, c);
        G.c.push(col, col);
        G.bz.push(curBias, curBias);
      }
    }
  }
  function basis(ax) {
    var t = Math.abs(ax[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    var u = norm(cross(ax, t)), v = cross(ax, u);
    return [u, v];
  }
  // rings: [offsetAlongAxis, radius, normalAxisPart, normalRadialPart]
  function revolve(A, ax, rings, S, col, tf) {
    var b = basis(ax), u = b[0], v = b[1];
    grid(rings.length, S, function (i, j) {
      var r = rings[i], th = 2 * Math.PI * j / S, c = Math.cos(th), s = Math.sin(th);
      var d = [u[0] * c + v[0] * s, u[1] * c + v[1] * s, u[2] * c + v[2] * s];
      return [
        [A[0] + ax[0] * r[0] + d[0] * r[1], A[1] + ax[1] * r[0] + d[1] * r[1], A[2] + ax[2] * r[0] + d[2] * r[1]],
        [ax[0] * r[2] + d[0] * r[3], ax[1] * r[2] + d[1] * r[3], ax[2] * r[2] + d[2] * r[3]]
      ];
    }, col, tf);
  }
  function capsule(A, B, r, col, tf, S, hr) {
    S = S || 10; hr = hr || 3;
    var d = sub(B, A), L = len3(d), ax = [d[0] / L, d[1] / L, d[2] / L], rings = [], k, p;
    for (k = 0; k <= hr; k++) { p = Math.PI / 2 * k / hr; rings.push([-r * Math.cos(p), r * Math.sin(p), -Math.cos(p), Math.sin(p)]); }
    var m = Math.max(1, Math.ceil(L / 4));
    for (k = 1; k < m; k++) { rings.push([L * k / m, r, 0, 1]); }
    for (k = 0; k <= hr; k++) { p = Math.PI / 2 * k / hr; rings.push([L + r * Math.sin(p), r * Math.cos(p), Math.sin(p), Math.cos(p)]); }
    revolve(A, ax, rings, S, col, tf);
  }
  // flat-ended tube (used for shorts legs)
  function tube(A, B, r, col, S, tf) {
    var d = sub(B, A), L = len3(d), ax = [d[0] / L, d[1] / L, d[2] / L], m = Math.max(1, Math.ceil(L / 4));
    var rings = [[0, 0, -1, 0], [0, r, -1, 0], [0, r, 0, 1]], k;
    for (k = 1; k < m; k++) { rings.push([L * k / m, r, 0, 1]); }
    rings.push([L, r, 0, 1], [L, r, 1, 0], [L, 0, 1, 0]);
    revolve(A, ax, rings, S || 12, col, tf || null);
  }
  function cyl(C, ax, r, hl, col, S) {
    revolve(C, ax, [[-hl, 0, -1, 0], [-hl, r, -1, 0], [-hl, r, 0, 1], [hl, r, 0, 1], [hl, r, 1, 0], [hl, 0, 1, 0]], S || 12, col, null);
  }
  function ellipsoid(c, rx, ry, rz, col, tf, rings, S, o) {
    rings = rings || 7; S = S || 12; o = o || {};
    var p0 = o.p0 || 0, p1 = o.p1 === undefined ? Math.PI : o.p1, t0 = o.t0 || 0, t1 = o.t1 === undefined ? 2 * Math.PI : o.t1;
    var open = (t1 - t0) < 2 * Math.PI - 1e-6;
    grid(rings + 1, S, function (i, j) {
      var ph = p0 + (p1 - p0) * i / rings, th = t0 + (t1 - t0) * j / (open ? S - 1 : S);
      var sp = Math.sin(ph), cp = Math.cos(ph), ct = Math.cos(th), st = Math.sin(th);
      return [
        [c[0] + rx * sp * ct, c[1] + ry * cp, c[2] + rz * sp * st],
        norm([sp * ct / rx, cp / ry, sp * st / rz])
      ];
    }, col, tf, open);
  }
  function loft(rings, S, col, tf, deform) {
    var dense = [rings[0]], q, k;
    for (q = 1; q < rings.length; q++) {
      var a0 = rings[q - 1], b0 = rings[q], nn = Math.max(1, Math.ceil(Math.abs(b0.y - a0.y) / 4));
      for (k = 1; k <= nn; k++) {
        var u0 = k / nn;
        dense.push({ y: a0.y + (b0.y - a0.y) * u0, rx: a0.rx + (b0.rx - a0.rx) * u0, rz: a0.rz + (b0.rz - a0.rz) * u0,
                     cx: (a0.cx || 0) + ((b0.cx || 0) - (a0.cx || 0)) * u0, cz: (a0.cz || 0) + ((b0.cz || 0) - (a0.cz || 0)) * u0 });
      }
    }
    rings = dense;
    var f = rings[0], l = rings[rings.length - 1];
    var R = [{ y: f.y, rx: 0, rz: 0, cx: f.cx || 0, cz: f.cz || 0, cap: -1 }].concat(rings, [{ y: l.y, rx: 0, rz: 0, cx: l.cx || 0, cz: l.cz || 0, cap: 1 }]);
    grid(R.length, S, function (i, j) {
      var r = R[i], th = 2 * Math.PI * j / S, c = Math.cos(th), s = Math.sin(th);
      var p = [(r.cx || 0) + r.rx * c, r.y, (r.cz || 0) + r.rz * s];
      if (deform) { p = deform(p); }
      var n = r.cap ? [0, r.cap, 0] : norm([c / r.rx, 0, s / r.rz]);
      return [p, n];
    }, col, tf);
  }

  /* colour slots */
  var SKIN = 0, HAIR = 1, SHIRT = 2, SHORTS = 3, SHOE = 4, PLATE = 5, HANDLE = 6, ACCENT = 7;

  /* =========================================================
     Arm motion: bones keep a fixed length, directions are blended
     between three key poses (start, middle, end)
     ========================================================= */
  var LU = 29, LF = 25;
  var PIV = [0, 98, -4];

  function keyDir(arr, t) { return t < 0.5 ? slerp(arr[0], arr[1], t * 2) : slerp(arr[1], arr[2], (t - 0.5) * 2); }
  function shoulderPos(ex, t) {
    var th = ex.bend || 0;
    var p = [21, 141 + (ex.raise || 0) * t, th ? -4 : 0];
    return th ? rotX(p, PIV, th) : p;
  }
  function armPose(ex, t, side) {
    var S = shoulderPos(ex, t);
    var U = keyDir(ex.U, t), F = keyDir(ex.F, t), N = keyDir(ex.N, t);
    if (side < 0) { S = [-S[0], S[1], S[2]]; U = [-U[0], U[1], U[2]]; F = [-F[0], F[1], F[2]]; N = [-N[0], N[1], N[2]]; }
    var E = add(S, mul(U, LU)), W = add(E, mul(F, LF)), C = add(W, mul(F, 3));
    var Np = sub(N, mul(F, dot(N, F)));
    if (len3(Np) < 0.05) { Np = [0, 0, 1]; }
    return { S: S, U: U, E: E, W: W, C: C, axis: norm(cross(F, Np)) };
  }

  function build(ex, t) {
    reset();
    var th = ex.bend || 0, z0 = th ? -4 : 0, r = (ex.raise || 0) * t;
    var tfT = null, tfP = null, tfH = null;
    if (th) {
      tfT = function (p) { return rotX(p, PIV, th); };
      tfP = function (p) { return rotX(p, PIV, th * 0.3); };
      var nb = tfT([0, 147, z0]);
      tfH = function (p) { return rotX(tfT(p), nb, -th * 0.45); };
    }

    /* legs */
    var hipY = th ? 92 : 90, hz = th ? -5 : 0, kz = th ? 3 : 0, kY = th ? 52 : 50, az = th ? -1 : 0;
    [-1, 1].forEach(function (s) {
      var x = 9 * s;
      bias(-1.5);
      capsule([x, 9, az], [x, kY, kz], 5.4, SKIN, null, 12, 3);
      var hemY = hipY - (hipY - kY) * 0.45, hemZ = hz + (kz - hz) * 0.45;
      capsule([x, kY, kz], [x, hemY + 2, hemZ], 8, SKIN, null, 12, 3);
      bias(0);
      tube([x, hipY + 3, hz], [x, hemY, hemZ], 9, SHORTS, 14);
      ellipsoid([x, 4.5, az + 4], 5.8, 4.5, 12, SHOE, null, 6, 12);
    });

    /* pelvis and torso */
    bias(-2);
    loft([
      { y: 86, rx: 17.2, rz: 10.4, cz: z0 }, { y: 94, rx: 16.4, rz: 9.7, cz: z0 }, { y: 101, rx: 14.8, rz: 9.0, cz: z0 }
    ], 14, SHORTS, tfP);
    bias(0);
    var deform = r > 0 ? function (p) { var k = clamp((p[1] - 125) / 18, 0, 1); return [p[0], p[1] + r * k, p[2]]; } : null;
    loft([
      { y: 98, rx: 17.6, rz: 11.2, cz: z0 }, { y: 108, rx: 15.8, rz: 10, cz: z0 }, { y: 122, rx: 17.5, rz: 10.5, cz: z0 },
      { y: 135, rx: 20.5, rz: 10.5, cz: z0 }, { y: 143, rx: 22, rz: 9.5, cz: z0 }, { y: 147, rx: 14, rz: 8, cz: z0 },
      { y: 149.5, rx: 6.5, rz: 5.5, cz: z0 }
    ], 18, SHIRT, tfT, deform);

    /* neck, head, hair, face bits */
    capsule([0, 148, z0], [0, 157, z0], 5.2, SKIN, tfH);
    bias(0.5);
    tube([0, 147, z0], [0, 151.5, z0], 6.7, SHIRT, 14, tfH);
    bias(0);
    bias(1);
    ellipsoid([0, 166, 0.5 + z0], 9.2, 11.5, 10.5, SKIN, tfH, 10, 16);
    bias(3);
    ellipsoid([0, 166, 0.5 + z0], 10.4, 12.7, 11.7, HAIR, tfH, 8, 18, { p1: 72 * DEG });
    ellipsoid([0, 166, 0.5 + z0], 10.4, 12.7, 11.7, HAIR, tfH, 6, 14, { p0: 50 * DEG, p1: 118 * DEG, t0: 150 * DEG, t1: 390 * DEG });
    bias(2);
    ellipsoid([0, 164, 11.7 + z0], 1.9, 2.4, 2.2, SKIN, tfH, 4, 6);
    ellipsoid([-9, 166, z0], 1.6, 2.8, 2, SKIN, tfH, 4, 6);
    ellipsoid([9, 166, z0], 1.6, 2.8, 2, SKIN, tfH, 4, 6);
    bias(0);

    if (ex.hl === 'trap') {
      capsule([5, 150.3 + 0.6 * r, z0 - 1.5], [18.5, 146.5 + r, z0 - 1.5], 3.3, ACCENT, tfT);
      capsule([-5, 150.3 + 0.6 * r, z0 - 1.5], [-18.5, 146.5 + r, z0 - 1.5], 3.3, ACCENT, tfT);
    }

    /* arms and dumbbells */
    [1, -1].forEach(function (side) {
      var a = armPose(ex, t, side);
      bias(1);
      capsule(a.S, a.E, 5.1, SKIN, null, 12, 3);
      capsule(a.E, a.W, 4.2, SKIN, null, 12, 3);
      bias(1.5);
      ellipsoid(a.C, 4.7, 4.7, 4.7, SKIN, null, 6, 10);
      bias(2);
      if (ex.hl === 'delt') { capsule(a.S, add(a.S, mul(a.U, 12)), 6.9, ACCENT, null, 12, 3); }
      else { capsule(a.S, add(a.S, mul(a.U, 12)), 6.2, SHIRT, null, 12, 3); }
      bias(1);
      cyl(a.C, a.axis, 1.7, 7.8, HANDLE, 8);
      bias(2.5);
      cyl(add(a.C, mul(a.axis, 8.6)), a.axis, 6.6, 2.5, PLATE, 12);
      cyl(add(a.C, mul(a.axis, -8.6)), a.axis, 6.6, 2.5, PLATE, 12);
      bias(0);
    });
  }

  /* =========================================================
     Renderer: camera, painter's-algorithm triangle sort, canvas 2D
     ========================================================= */
  var PITCH = 11 * DEG, CAMD = 520;
  var palCache = null, palTime = 0, shadeCache = {};

  function hex(s) {
    s = (s || '').trim();
    if (s.charAt(0) === '#') {
      if (s.length === 4) { s = '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3]; }
      return [parseInt(s.substr(1, 2), 16), parseInt(s.substr(3, 2), 16), parseInt(s.substr(5, 2), 16)];
    }
    var m = s.match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
    return m ? [+m[1], +m[2], +m[3]] : [128, 128, 128];
  }
  function palette() {
    var now = performance.now();
    if (palCache && now - palTime < 400) { return palCache; }
    var cs = getComputedStyle(document.documentElement);
    function g(n) { return cs.getPropertyValue(n); }
    var p = {
      rgb: [hex(g('--skin')), hex(g('--hair')), hex(g('--shirt')), hex(g('--shorts')), hex(g('--shoe')), hex(g('--plate')), hex(g('--handle')), hex(g('--hot'))],
      ink: g('--ink').trim(), bg: g('--bg').trim(), line: g('--line').trim(), muted: g('--muted').trim(), accent: g('--accent').trim()
    };
    var key = p.rgb.join('|') + p.bg;
    if (!palCache || palCache.key !== key) { shadeCache = {}; }
    p.key = key; palCache = p; palTime = now;
    return p;
  }
  function shadeStr(pal, ci, lv) {
    var key = ci * 100 + lv, s = shadeCache[key];
    if (!s) {
      var c = pal.rgb[ci], k = lv / 20;
      s = 'rgb(' + Math.min(255, Math.round(c[0] * k)) + ',' + Math.min(255, Math.round(c[1] * k)) + ',' + Math.min(255, Math.round(c[2] * k)) + ')';
      shadeCache[key] = s;
    }
    return s;
  }

  var LIGHT = norm([-0.5, 0.65, 0.75]);
  var bufN = 0, CX, CY, CZ, SX, SY, NX, NY, NZ, keys = new Float32Array(1), lvArr = new Uint8Array(1);
  function ensure(nv, nt) {
    if (nv > bufN) {
      bufN = nv + 512;
      CX = new Float32Array(bufN); CY = new Float32Array(bufN); CZ = new Float32Array(bufN);
      SX = new Float32Array(bufN); SY = new Float32Array(bufN);
      NX = new Float32Array(bufN); NY = new Float32Array(bufN); NZ = new Float32Array(bufN);
    }
    if (nt > keys.length) { keys = new Float32Array(nt + 512); lvArr = new Uint8Array(nt + 512); }
  }

  function draw(st) {
    var cv = st.cv, ctx = st.ctx, W = cv.width, H = cv.height;
    if (!W || !H) { return; }
    var ex = st.ex, pal = palette();
    ctx.clearRect(0, 0, W, H);

    build(ex, st.t);

    var yaw = st.yaw * DEG, cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(PITCH), sp = Math.sin(PITCH);
    var f = (H / ex.cam.span) * CAMD, ox = W / 2, oy = H / 2;
    var tx = 0, ty = ex.cam.ty, tz = ex.cam.tz || 0;

    function view(px, py, pz) {
      var qx = px - tx, qy = py - ty, qz = pz - tz;
      var x1 = qx * cyw - qz * syw, z1 = qx * syw + qz * cyw;
      var y2 = qy * cp - z1 * sp, z2 = qy * sp + z1 * cp;
      var s = f / (CAMD - z2);
      return [ox + x1 * s, oy - y2 * s, z2];
    }

    /* floor disc, front marker, contact shadow */
    var i, a, pt, ang;
    var dbg = !!(window.__sh && window.__sh.holes);
    if (dbg) { ctx.fillStyle = '#ff00ff'; ctx.fillRect(0, 0, W, H); }
    if (!dbg) {
    ctx.beginPath();
    for (i = 0; i < 48; i++) {
      ang = 2 * Math.PI * i / 48; pt = view(62 * Math.sin(ang), 0, 62 * Math.cos(ang));
      if (i) { ctx.lineTo(pt[0], pt[1]); } else { ctx.moveTo(pt[0], pt[1]); }
    }
    ctx.closePath();
    ctx.globalAlpha = 0.55; ctx.fillStyle = pal.line; ctx.fill();
    ctx.globalAlpha = 0.9; ctx.lineWidth = 1.5 * st.dpr; ctx.strokeStyle = pal.muted; ctx.stroke();
    var m0 = view(0, 0, 76), m1 = view(-6, 0, 65), m2 = view(6, 0, 65);
    ctx.beginPath(); ctx.moveTo(m0[0], m0[1]); ctx.lineTo(m1[0], m1[1]); ctx.lineTo(m2[0], m2[1]); ctx.closePath();
    ctx.fillStyle = pal.muted; ctx.fill();
    ctx.beginPath();
    for (i = 0; i < 32; i++) {
      ang = 2 * Math.PI * i / 32; pt = view(27 * Math.sin(ang), 0, 3 + 17 * Math.cos(ang));
      if (i) { ctx.lineTo(pt[0], pt[1]); } else { ctx.moveTo(pt[0], pt[1]); }
    }
    ctx.closePath(); ctx.globalAlpha = 0.22; ctx.fillStyle = '#000'; ctx.fill();
    ctx.globalAlpha = 1;
    }

    /* transform vertices */
    var nv = G.v.length / 3, nt = G.t.length / 3;
    ensure(nv, nt);
    var v = G.v, n = G.n;
    for (i = 0; i < nv; i++) {
      var px = v[3 * i], py = v[3 * i + 1], pz = v[3 * i + 2];
      var qx = px - tx, qy = py - ty, qz = pz - tz;
      var x1 = qx * cyw - qz * syw, z1 = qx * syw + qz * cyw;
      var y2 = qy * cp - z1 * sp, z2 = qy * sp + z1 * cp;
      var s = f / (CAMD - z2);
      CX[i] = x1; CY[i] = y2; CZ[i] = z2;
      SX[i] = ox + x1 * s; SY[i] = oy - y2 * s;
      var nx = n[3 * i], ny = n[3 * i + 1], nz = n[3 * i + 2];
      var n1 = nx * cyw - nz * syw, m1z = nx * syw + nz * cyw;
      NX[i] = n1; NY[i] = ny * cp - m1z * sp; NZ[i] = ny * sp + m1z * cp;
    }

    /* cull, shade, sort */
    var T = G.t, order = [], ti;
    for (ti = 0; ti < nt; ti++) {
      var ia = T[3 * ti], ib = T[3 * ti + 1], ic = T[3 * ti + 2];
      var gx = NX[ia] + NX[ib] + NX[ic], gy = NY[ia] + NY[ib] + NY[ic], gz = NZ[ia] + NZ[ib] + NZ[ic];
      var gl = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1;
      gx /= gl; gy /= gl; gz /= gl;
      var mx = (CX[ia] + CX[ib] + CX[ic]) / 3, my = (CY[ia] + CY[ib] + CY[ic]) / 3, mz = (CZ[ia] + CZ[ib] + CZ[ic]) / 3;
      var vx = -mx, vy = -my, vz = CAMD - mz, vl = Math.sqrt(vx * vx + vy * vy + vz * vz);
      if ((gx * vx + gy * vy + gz * vz) / vl < -0.3) { continue; }
      var lam = gx * LIGHT[0] + gy * LIGHT[1] + gz * LIGHT[2];
      var shade = 0.5 + 0.62 * (lam > 0 ? lam : 0);
      lvArr[ti] = clamp(Math.round(shade * 20), 6, 26);
      keys[ti] = mz + G.bz[ti];
      order.push(ti);
    }
    order.sort(function (p, q) { return keys[p] - keys[q]; });

    var pad = 0.7 * st.dpr;
    for (i = 0; i < order.length; i++) {
      ti = order[i];
      var A = T[3 * ti], B = T[3 * ti + 1], C = T[3 * ti + 2];
      var ccx = (SX[A] + SX[B] + SX[C]) / 3, ccy = (SY[A] + SY[B] + SY[C]) / 3;
      var ax = SX[A] - ccx, ay = SY[A] - ccy, al = Math.sqrt(ax * ax + ay * ay) || 1;
      var bx = SX[B] - ccx, by = SY[B] - ccy, bl = Math.sqrt(bx * bx + by * by) || 1;
      var cx2 = SX[C] - ccx, cy2 = SY[C] - ccy, cl = Math.sqrt(cx2 * cx2 + cy2 * cy2) || 1;
      ctx.fillStyle = shadeStr(pal, G.c[ti], lvArr[ti]);
      ctx.beginPath();
      ctx.moveTo(SX[A] + ax / al * pad, SY[A] + ay / al * pad);
      ctx.lineTo(SX[B] + bx / bl * pad, SY[B] + by / bl * pad);
      ctx.lineTo(SX[C] + cx2 / cl * pad, SY[C] + cy2 / cl * pad);
      ctx.closePath();
      ctx.fill();
    }

    /* dumbbell path with a direction arrow that follows the movement */
    (dbg ? [] : ex.trails).forEach(function (tr) {
      var P2 = tr.map(function (p) { var q = view(p[0], p[1], p[2]); return [q[0], q[1]]; });
      var n = P2.length - 1, idx = -1, dir = 1, dpr = st.dpr;
      if (st.mode === 'start') { idx = n; dir = 1; }
      else if (st.mode === 'end') { idx = 0; dir = -1; }
      else if (st.phase === 'up') { idx = Math.min(n, Math.round(st.t * n) + 4); dir = 1; }
      else if (st.phase === 'down') { idx = Math.max(0, Math.round(st.t * n) - 4); dir = -1; }
      function path() {
        ctx.beginPath();
        P2.forEach(function (q, k) { if (k) { ctx.lineTo(q[0], q[1]); } else { ctx.moveTo(q[0], q[1]); } });
      }
      ctx.save();
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalAlpha = 0.92;
      ctx.setLineDash([7 * dpr, 6 * dpr]);
      path(); ctx.strokeStyle = pal.bg; ctx.lineWidth = 7 * dpr; ctx.stroke();
      path(); ctx.strokeStyle = pal.ink; ctx.lineWidth = 2.6 * dpr; ctx.stroke();
      ctx.setLineDash([]);
      if (idx >= 0) {
        var tip = P2[idx], from = P2[clamp(idx - dir * 4, 0, n)];
        var dx = tip[0] - from[0], dy = tip[1] - from[1], dl = Math.sqrt(dx * dx + dy * dy);
        if (dl > 3) {
          dx /= dl; dy /= dl;
          var hs = 13 * dpr, bx = tip[0] - dx * hs, by = tip[1] - dy * hs;
          ctx.beginPath();
          ctx.moveTo(tip[0] + dx * hs * 0.35, tip[1] + dy * hs * 0.35);
          ctx.lineTo(bx - dy * hs * 0.6, by + dx * hs * 0.6);
          ctx.lineTo(bx + dy * hs * 0.6, by - dx * hs * 0.6);
          ctx.closePath();
          ctx.fillStyle = pal.ink; ctx.strokeStyle = pal.bg; ctx.lineWidth = 3 * dpr;
          ctx.stroke(); ctx.fill();
        }
      }
      ctx.restore();
    });
  }

  /* =========================================================
     Glue: prepare exercise data, wire controls, one shared render loop
     ========================================================= */
  function prep(ex) {
    if (ex._ready) { return ex; }
    ex.U = ex.U.map(norm); ex.F = ex.F.map(norm); ex.N = ex.N.map(norm);
    if (ex.N.length === 2) { ex.N = [ex.N[0], norm(slerp(ex.N[0], ex.N[1], 0.5)), ex.N[1]]; }
    ex.bend = (ex.bendDeg || 0) * DEG;
    var pts = [], i;
    for (i = 0; i <= 24; i++) { pts.push(armPose(ex, i / 24, 1).C); }
    ex.trails = [pts, pts.map(function (p) { return [-p[0], p[1], p[2]]; })];
    ex._ready = true;
    return ex;
  }

  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var states = [], raf = 0, io = null, observers = [];

  function norm360(y) { return ((y % 360) + 360) % 360; }
  function angDist(a, b) { return Math.abs(((a - b + 540) % 360) - 180); }
  function setBar(st, e) { st.fill.style.width = Math.round(e * 100) + '%'; }

  function syncButtons(st) {
    st.btnStart.setAttribute('aria-pressed', st.mode === 'start' ? 'true' : 'false');
    st.btnEnd.setAttribute('aria-pressed', st.mode === 'end' ? 'true' : 'false');
    st.btnPlay.setAttribute('aria-pressed', st.mode === 'play' ? 'true' : 'false');
    st.btnPlay.textContent = st.mode === 'play' ? 'Pause' : 'Play';
  }
  function syncViews(st) {
    var y = norm360(st.yaw);
    var key = [angDist(y, 0) < 5, angDist(y, 90) < 5 || angDist(y, 270) < 5, angDist(y, 180) < 5, st.spin].join();
    if (key === st.viewKey) { return; }
    st.viewKey = key;
    var flags = key.split(',');
    st.vBtns.forEach(function (b, k) { b.setAttribute('aria-pressed', flags[k] === 'true' ? 'true' : 'false'); });
  }
  function setMode(st, mode) {
    var now = performance.now(), prev = st.mode;
    st.mode = mode;
    if (mode === 'start' || mode === 'end') {
      st.t = mode === 'start' ? 0 : 1;
      st.phaseEl.textContent = mode === 'start' ? 'Start position' : 'End position';
      st.descEl.textContent = mode === 'start' ? st.ex.startText : st.ex.endText;
      st.last = st.t; st.phase = '';
      setBar(st, st.t);
    } else if (mode === 'play') {
      if (prev === 'paused') { st.t0 += now - st.pausedAt; } else { st.t0 = now; }
      st.descEl.textContent = 'Slow rep. Tap Start or End to freeze a position, and drag to look from any angle.';
      st.last = -1; st.phase = '';
    } else if (mode === 'paused') {
      st.pausedAt = now;
    }
    st.dirty = true;
    syncButtons(st);
    kick();
  }
  function turnTo(st, target) {
    var from = st.yaw, opts = target === 90 ? [90, 270] : [target], best = opts[0], bd = 1e9;
    opts.forEach(function (o) {
      var d = ((o - norm360(from) + 540) % 360) - 180;
      if (Math.abs(d) < bd) { bd = Math.abs(d); best = d; }
    });
    st.spin = false; st.vel = 0;
    if (reduce) { st.yaw = from + best; st.dirty = true; syncViews(st); kick(); return; }
    st.tw = { from: from, delta: best, t0: performance.now(), dur: 650 };
    kick();
  }
  function resize(st) {
    var r = st.cv.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
    if (w && (st.cv.width !== w || st.cv.height !== h)) { st.cv.width = w; st.cv.height = h; }
    st.dpr = dpr; st.dirty = true;
  }

  function mount(sec, ex) {
    prep(ex);
    var seg = sec.querySelectorAll('.seg button'), vb = sec.querySelectorAll('.views button'), cv = sec.querySelector('canvas');
    var st = {
      ex: ex, cv: cv, ctx: cv.getContext('2d'), dpr: 1, root: sec,
      fill: sec.querySelector('.bar i'),
      phaseEl: sec.querySelector('.phase'), descEl: sec.querySelector('.desc'),
      btnStart: seg[0], btnEnd: seg[1], btnPlay: seg[2],
      vBtns: [vb[0], vb[1], vb[2], vb[3]], viewKey: '',
      mode: '', t: 0, t0: 0, pausedAt: 0, last: -1, phase: '',
      yaw: ex.yaw, vel: 0, spin: false, tw: null, dragging: false, dirty: true, lastNow: 0,
      visible: typeof IntersectionObserver === 'undefined'
    };
    states.push(st);
    sec.__st = st;

    st.btnStart.addEventListener('click', function () { setMode(st, 'start'); });
    st.btnEnd.addEventListener('click', function () { setMode(st, 'end'); });
    st.btnPlay.addEventListener('click', function () { setMode(st, st.mode === 'play' ? 'paused' : 'play'); });
    vb[0].addEventListener('click', function () { turnTo(st, 0); });
    vb[1].addEventListener('click', function () { turnTo(st, 90); });
    vb[2].addEventListener('click', function () { turnTo(st, 180); });
    vb[3].addEventListener('click', function () { st.spin = !st.spin; st.tw = null; st.vel = 0; st.viewKey = ''; syncViews(st); kick(); });

    cv.addEventListener('pointerdown', function (e) {
      st.dragging = true; st.dragX = e.clientX; st.lastMove = performance.now(); st.vel = 0; st.tw = null;
      if (st.spin) { st.spin = false; }
      try { cv.setPointerCapture(e.pointerId); } catch (err) {}
      cv.style.cursor = 'grabbing';
    });
    cv.addEventListener('pointermove', function (e) {
      if (!st.dragging) { return; }
      var now = performance.now(), dx = e.clientX - st.dragX, dt = Math.max(1, now - st.lastMove);
      st.dragX = e.clientX; st.lastMove = now;
      var d = -dx * 0.6;
      st.yaw += d; st.vel = 0.7 * st.vel + 0.3 * (d / dt);
      st.dirty = true; kick();
    });
    function endDrag() { if (st.dragging) { st.dragging = false; cv.style.cursor = 'grab'; kick(); } }
    cv.addEventListener('pointerup', endDrag);
    cv.addEventListener('pointercancel', endDrag);
    cv.addEventListener('lostpointercapture', endDrag);
    cv.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { st.yaw += 15; st.spin = false; st.tw = null; st.dirty = true; kick(); e.preventDefault(); }
      if (e.key === 'ArrowRight') { st.yaw -= 15; st.spin = false; st.tw = null; st.dirty = true; kick(); e.preventDefault(); }
    });

    if (typeof ResizeObserver !== 'undefined') {
      var ro = new ResizeObserver(function () { resize(st); kick(); });
      ro.observe(cv); observers.push(ro);
    }
    resize(st);
    setMode(st, reduce ? 'start' : 'play');
    syncViews(st);

    if (typeof IntersectionObserver !== 'undefined') {
      if (!io) {
        io = new IntersectionObserver(function (entries) {
          entries.forEach(function (en) {
            var s = en.target.__st;
            if (!s) { return; }
            s.visible = en.isIntersecting;
            if (s.visible) { resize(s); s.lastNow = 0; }
          });
          kick();
        }, { threshold: 0.1 });
      }
      io.observe(sec);
    }
    return st;
  }

  function unmountAll() {
    states.length = 0;
    observers.forEach(function (o) { o.disconnect(); }); observers.length = 0;
    if (io) { io.disconnect(); io = null; }
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
  }

  function tick(now) {
    var any = false;
    states.forEach(function (st) {
      if (!st.visible) { return; }
      var dt = st.lastNow ? Math.min(60, now - st.lastNow) : 16;
      st.lastNow = now;
      var dirty = st.dirty; st.dirty = false;

      if (st.mode === 'play') {
        any = true;
        var c = st.ex.timing, cyc = c.up + c.top + c.down + c.bottom;
        var p = ((now - st.t0) / 1000) % cyc, e, ph;
        if (p < c.up) { e = ease(p / c.up); ph = 'up'; }
        else if (p < c.up + c.top) { e = 1; ph = 'top'; }
        else if (p < c.up + c.top + c.down) { e = 1 - ease((p - c.up - c.top) / c.down); ph = 'down'; }
        else { e = 0; ph = 'bottom'; }
        if (Math.abs(e - st.last) > 0.002) { st.t = e; st.last = e; setBar(st, e); dirty = true; }
        if (ph !== st.phase) { st.phase = ph; st.phaseEl.textContent = st.ex.labels[ph]; }
      }
      if (st.tw) {
        any = true;
        var q = Math.min(1, (now - st.tw.t0) / st.tw.dur);
        st.yaw = st.tw.from + st.tw.delta * ease(q);
        dirty = true;
        if (q >= 1) { st.tw = null; }
      } else if (st.spin && !st.dragging) {
        any = true; st.yaw -= 0.045 * dt; dirty = true;
      } else if (!st.dragging && Math.abs(st.vel) > 0.003) {
        any = true; st.yaw += st.vel * dt; st.vel *= Math.exp(-dt / 320); dirty = true;
      }
      if (dirty) { draw(st); syncViews(st); }
    });
    raf = any ? requestAnimationFrame(tick) : 0;
  }
  function kick() { if (!raf) { raf = requestAnimationFrame(tick); } }
  window.addEventListener('resize', function () { states.forEach(resize); kick(); });

  window.Engine = { mount: mount, unmountAll: unmountAll, redraw: function () { states.forEach(function (s) { s.dirty = true; }); kick(); } };
})();
