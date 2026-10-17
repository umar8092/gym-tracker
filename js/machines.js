/* Simple schematic drawings of the gym equipment, so you can recognise each machine and decide whether to keep the exercise.
   Geometric side views (front view for the pull-up bar). Styled by .mc-* classes in app.css. */
(function () {
  function ln(x1, y1, x2, y2, c) { return '<line class="' + c + '" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"/>'; }
  function rect(x, y, w, h, c, r) { return '<rect class="' + c + '" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + (r || 0) + '"/>'; }
  function circ(x, y, r, c) { return '<circle class="' + c + '" cx="' + x + '" cy="' + y + '" r="' + r + '"/>'; }
  function limb(pts) { return '<polyline class="mc-limb" points="' + pts.map(function (p) { return p.join(','); }).join(' ') + '"/>'; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  // Text label placed at (x, y); a thin leader runs from the nearest point of the text box to the part at (tx, ty).
  // anchor 'start' = text begins at x, 'end' = text ends at x.
  function lab(t, x, y, tx, ty, anchor) {
    var w = 5.4 * t.length, x0 = anchor === 'end' ? x - w : x, x1 = x0 + w, y0 = y - 10, y1 = y + 3;
    var sx = clamp(tx, x0, x1), sy = clamp(ty, y0, y1), out = '';
    if (sx !== tx || sy !== ty) { out += ln(sx, sy, tx, ty, 'mc-lead'); }
    return out + '<text class="mc-lab" x="' + x + '" y="' + y + '" text-anchor="' + anchor + '">' + t + '</text>';
  }
  function stack(x, y, w, h) {
    var s = rect(x, y, w, h, 'mc-stack', 3), i;
    for (i = 1; i < 8; i++) { s += ln(x + 2, y + i * h / 8, x + w - 2, y + i * h / 8, 'mc-plate-line'); }
    return s;
  }
  var GROUND = ln(6, 150, 234, 150, 'mc-floor');

  var D = {
    'machine-chest-press': function () {
      return stack(14, 34, 30, 116) + rect(44, 142, 128, 8, 'mc-frame', 2) +
        rect(64, 58, 12, 58, 'mc-pad', 5) + rect(60, 112, 54, 10, 'mc-pad', 4) + ln(86, 122, 86, 142, 'mc-bar') +
        ln(44, 70, 66, 62, 'mc-bar') + ln(68, 60, 126, 66, 'mc-bar') + circ(126, 66, 4, 'mc-grip') +
        circ(76, 50, 9, 'mc-head') + limb([[78, 64], [86, 108]]) + limb([[86, 108], [122, 110], [124, 144]]) + limb([[78, 66], [98, 78], [124, 67]]) +
        lab('Weight stack', 6, 22, 28, 38, 'start') + lab('Handles', 150, 40, 128, 63, 'start') + lab('Seat', 142, 132, 112, 120, 'start');
    },
    'lat-pulldown': function () {
      return stack(196, 24, 30, 126) + ln(196, 22, 96, 22, 'mc-bar') + circ(96, 22, 5, 'mc-grip') + ln(96, 27, 96, 34, 'mc-cable') +
        ln(72, 34, 120, 34, 'mc-bar') + circ(72, 34, 3.5, 'mc-grip') + circ(120, 34, 3.5, 'mc-grip') +
        rect(64, 112, 52, 10, 'mc-pad', 4) + ln(90, 122, 90, 150, 'mc-bar') +
        ln(132, 150, 132, 103, 'mc-bar') + rect(114, 94, 36, 9, 'mc-pad', 4) +
        circ(84, 56, 9, 'mc-head') + limb([[88, 68], [88, 108]]) + limb([[88, 108], [128, 108], [130, 146]]) + limb([[88, 70], [102, 56], [98, 36]]) +
        lab('Weight stack', 120, 12, 206, 30, 'start') + lab('Bar', 8, 38, 72, 34, 'start') + lab('Thigh pads', 190, 84, 142, 95, 'end') + lab('Seat', 8, 134, 66, 119, 'start');
    },
    'seated-cable-row': function () {
      return stack(10, 58, 28, 92) + ln(38, 128, 112, 104, 'mc-cable') + ln(112, 99, 112, 109, 'mc-bar') + circ(112, 104, 3, 'mc-grip') +
        rect(58, 120, 22, 30, 'mc-frame', 3) + rect(40, 144, 150, 6, 'mc-frame', 2) +
        rect(150, 112, 40, 10, 'mc-pad', 4) + ln(170, 122, 170, 144, 'mc-bar') +
        circ(176, 50, 9, 'mc-head') + limb([[172, 66], [168, 108]]) + limb([[168, 108], [132, 104], [84, 124]]) + limb([[172, 70], [144, 88], [114, 104]]) +
        lab('Weight stack', 6, 46, 22, 62, 'start') + lab('Handle', 60, 88, 110, 102, 'start') + lab('Foot plate', 96, 140, 80, 132, 'start') + lab('Seat', 200, 124, 190, 117, 'start');
    },
    'leg-press': function () {
      return ln(56, 140, 188, 42, 'mc-rail') + ln(64, 146, 188, 52, 'mc-bar') +
        rect(40, 128, 56, 10, 'mc-pad', 4) +
        ln(134, 44, 160, 80, 'mc-plateform') + rect(168, 36, 10, 24, 'mc-stack', 2) + rect(180, 44, 10, 24, 'mc-stack', 2) +
        circ(44, 88, 9, 'mc-head') + limb([[54, 100], [84, 120]]) + limb([[84, 120], [112, 88], [140, 66]]) +
        lab('Foot plate', 60, 34, 138, 52, 'start') + lab('Seat', 6, 118, 44, 133, 'start') + lab('Weight plates', 232, 104, 186, 64, 'end');
    },
    'leg-curl': function () {
      return stack(198, 50, 28, 100) + rect(36, 100, 120, 12, 'mc-pad', 5) + ln(60, 112, 60, 150, 'mc-bar') + ln(130, 112, 130, 150, 'mc-bar') +
        ln(160, 108, 180, 108, 'mc-bar') + rect(172, 82, 8, 28, 'mc-grip', 3) + ln(180, 96, 198, 96, 'mc-cable') +
        circ(34, 88, 9, 'mc-head') + limb([[46, 94], [118, 94]]) + limb([[118, 94], [150, 94], [170, 94]]) +
        '<path class="mc-move" d="M176 80 Q176 52 148 46"/>' +
        lab('Ankle pad', 232, 36, 178, 82, 'end') + lab('Bench', 84, 134, 84, 114, 'start') + lab('Weight stack', 100, 18, 204, 56, 'start');
    },
    'cable-pushdown': function () {
      return stack(196, 24, 30, 126) + ln(196, 28, 138, 28, 'mc-bar') + circ(138, 28, 5, 'mc-grip') + ln(138, 33, 130, 82, 'mc-cable') +
        ln(120, 86, 140, 86, 'mc-bar') + circ(130, 86, 3.5, 'mc-grip') +
        circ(94, 44, 9, 'mc-head') + limb([[94, 58], [94, 102]]) + limb([[94, 102], [92, 126], [94, 146]]) + limb([[94, 60], [98, 88], [124, 86]]) +
        lab('High pulley', 150, 14, 140, 26, 'start') + lab('Rope or bar', 190, 112, 134, 89, 'end') + lab('Weight stack', 190, 142, 198, 134, 'end');
    },
    'pull-up': function () {
      return ln(62, 150, 62, 28, 'mc-bar') + ln(178, 150, 178, 28, 'mc-bar') + ln(56, 28, 184, 28, 'mc-bar2') +
        circ(120, 56, 9, 'mc-head') + limb([[120, 70], [120, 108]]) + limb([[108, 72], [96, 28]]) + limb([[132, 72], [144, 28]]) +
        limb([[120, 108], [114, 142]]) + limb([[120, 108], [126, 142]]) +
        lab('Pull-up bar', 90, 14, 110, 27, 'start') + lab('Upright', 232, 90, 180, 90, 'end');
    }
  };

  window.Machines = {
    has: function (id) { return !!D[id]; },
    svg: function (ex) {
      if (!D[ex.id]) { return ''; }
      return '<svg class="mach-svg" viewBox="0 0 240 160" role="img" aria-label="Schematic drawing of the equipment for ' + ex.name + '">' + GROUND + D[ex.id]() + '</svg>';
    }
  };
})();
