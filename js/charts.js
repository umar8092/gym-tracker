/* Tiny SVG charts, styled by CSS classes (.ch-*). No library. */
(function () {
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function fmt(n) { return Math.abs(n - Math.round(n)) < 0.05 ? String(Math.round(n)) : n.toFixed(1); }

  /* pts: [{x: number, y: number, label?: string}], opts: {w,h,goal,unit,aria,xLabel(x)} */
  function line(pts, o) {
    o = o || {};
    var W = o.w || 320, H = o.h || 170, L = 34, R = 12, T = 12, B = 24;
    if (!pts.length) { return ''; }
    var xs = pts.map(function (p) { return p.x; }), ys = pts.map(function (p) { return p.y; });
    if (o.goal != null) { ys.push(o.goal); }
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    if (x1 === x0) { x1 = x0 + 1; }
    var padY = (y1 - y0) * 0.15 || 1; y0 -= padY; y1 += padY;
    function X(x) { return L + (x - x0) / (x1 - x0) * (W - L - R); }
    function Y(y) { return T + (1 - (y - y0) / (y1 - y0)) * (H - T - B); }
    var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + X(p.x).toFixed(1) + ' ' + Y(p.y).toFixed(1); }).join(' ');
    var s = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.aria || 'Line chart') + '">';
    [0, 0.5, 1].forEach(function (f) {
      var yv = y0 + (y1 - y0) * f, yy = Y(yv);
      s += '<line class="ch-grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + yy.toFixed(1) + '" y2="' + yy.toFixed(1) + '"/>';
      s += '<text class="ch-tick" x="' + (L - 6) + '" y="' + (yy + 4).toFixed(1) + '" text-anchor="end">' + fmt(yv) + '</text>';
    });
    if (o.goal != null) {
      var gy = Y(o.goal).toFixed(1);
      s += '<line class="ch-goal" x1="' + L + '" x2="' + (W - R) + '" y1="' + gy + '" y2="' + gy + '"/>';
      s += '<text class="ch-tick ch-goal-t" x="' + (W - R) + '" y="' + (Y(o.goal) - 5).toFixed(1) + '" text-anchor="end">Goal ' + fmt(o.goal) + (o.unit || '') + '</text>';
    }
    s += '<path class="ch-line" d="' + d + '"/>';
    pts.forEach(function (p) { s += '<circle class="ch-dot" cx="' + X(p.x).toFixed(1) + '" cy="' + Y(p.y).toFixed(1) + '" r="3.2"><title>' + esc(p.label || (fmt(p.y) + (o.unit || ''))) + '</title></circle>'; });
    var xl = o.xLabel || String;
    s += '<text class="ch-tick" x="' + L + '" y="' + (H - 6) + '">' + esc(xl(x0)) + '</text>';
    s += '<text class="ch-tick" x="' + (W - R) + '" y="' + (H - 6) + '" text-anchor="end">' + esc(xl(x1)) + '</text>';
    return s + '</svg>';
  }

  /* bars: [{label, value}] */
  function bars(items, o) {
    o = o || {};
    var W = o.w || 320, H = o.h || 150, L = 26, R = 6, T = 12, B = 24;
    var max = Math.max(o.max || 0, Math.max.apply(null, items.map(function (b) { return b.value; })), 1);
    var bw = (W - L - R) / items.length;
    var s = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.aria || 'Bar chart') + '">';
    [0, 1].forEach(function (f) {
      var yy = T + (1 - f) * (H - T - B);
      s += '<line class="ch-grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + yy + '" y2="' + yy + '"/>';
      s += '<text class="ch-tick" x="' + (L - 6) + '" y="' + (yy + 4) + '" text-anchor="end">' + fmt(max * f) + '</text>';
    });
    items.forEach(function (b, i) {
      var h = (H - T - B) * b.value / max, x = L + i * bw + bw * 0.18;
      s += '<rect class="ch-bar" x="' + x.toFixed(1) + '" y="' + (H - B - h).toFixed(1) + '" width="' + (bw * 0.64).toFixed(1) + '" height="' + h.toFixed(1) + '" rx="3"><title>' + esc(b.label + ': ' + fmt(b.value)) + '</title></rect>';
      s += '<text class="ch-tick" x="' + (x + bw * 0.32).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(b.label) + '</text>';
    });
    return s + '</svg>';
  }

  window.Charts = { line: line, bars: bars };
})();
