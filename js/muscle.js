/* Flat SVG muscle diagrams. Left half is drawn, the right half is mirrored.
   .mus = neutral, .mus.p = primary (red), .mus.s = helping (pink). Upper-body paths are from the shoulder prototype. */
(function () {
  var ARM = 'M72 152 L98 150 Q104 190 98 232 Q86 240 74 232 Q68 190 72 152 Z';
  var FORE = 'M74 236 Q86 244 98 236 Q102 268 96 296 Q86 300 78 296 Q70 268 74 236 Z';
  var DELT_LAT = 'M86 82 Q66 82 58 106 Q54 130 66 146 L74 152 L84 150 Q84 110 86 82 Z';
  var TRAP_UP = 'M144 54 Q118 58 90 76 L84 86 L104 90 Q128 80 146 72 Z';

  var UPPER = {
    front: [
      ['biceps', ARM], ['forearm', FORE], ['trap_up', TRAP_UP],
      ['pec_up', 'M158 88 Q130 82 104 94 Q106 108 112 118 Q136 112 158 114 Z'],
      ['pec_low', 'M158 114 Q136 112 112 118 Q102 136 108 156 Q134 172 158 166 Z'],
      ['abs', 'M158 172 Q136 174 122 178 Q118 214 126 244 L158 254 Z'],
      ['delt_ant', 'M104 94 Q96 82 86 82 Q84 110 84 150 Q96 154 100 148 Q104 120 104 94 Z'],
      ['delt_lat', DELT_LAT]
    ],
    back: [
      ['triceps', ARM], ['forearm', FORE],
      ['infra', 'M112 120 Q102 124 98 136 Q100 154 118 158 Q134 150 136 126 Q124 116 112 120 Z'],
      ['teres', 'M118 158 Q100 160 94 172 L110 180 Q124 174 128 160 Z'],
      ['lats', 'M128 162 Q112 166 106 184 Q106 214 124 240 Q140 228 150 212 Q136 196 128 162 Z'],
      ['trap_low', 'M158 122 L112 120 Q128 160 158 206 Z'],
      ['trap_mid', 'M158 94 L106 94 Q104 106 108 118 L158 122 Z'],
      ['trap_up', TRAP_UP],
      ['back_low', 'M158 210 L148 218 Q134 236 128 256 L158 262 Z'],
      ['delt_post', 'M106 96 Q98 84 88 84 Q84 110 84 150 Q96 154 100 146 Q104 118 106 96 Z'],
      ['delt_lat', DELT_LAT]
    ]
  };
  var UPPER_NECK = 'M143 8 L143 58 Q160 66 177 58 L177 8 Z';

  var LOWER_BASE = 'M104 0 L216 0 L220 40 Q216 56 204 62 L116 62 Q104 56 100 40 Z';
  var SHAPE_CALF = 'M110 218 Q100 244 106 276 Q114 300 134 304 Q148 296 150 270 Q156 240 152 218 Q132 224 110 218 Z';
  var LOWER = {
    front: [
      ['quad', 'M158 62 Q122 56 104 84 Q96 130 106 184 Q112 206 134 210 Q154 206 158 198 Z'],
      ['shin', SHAPE_CALF], ['foot', 'M112 308 Q108 322 124 324 L152 324 Q156 316 150 308 Z']
    ],
    back: [
      ['back_low', 'M158 4 L120 4 Q112 22 116 44 L158 56 Z'],
      ['glute', 'M158 56 L116 48 Q98 64 100 92 Q108 112 130 114 Q152 112 158 104 Z'],
      ['ham', 'M158 112 Q130 116 106 108 Q96 140 104 186 Q114 208 136 210 Q152 206 158 198 Z'],
      ['calf', SHAPE_CALF], ['foot', 'M112 308 Q108 322 124 324 L152 324 Q156 316 150 308 Z']
    ]
  };

  // id -> [label, anchor x (left half), anchor y, side of the label]
  var LAB = {
    upper: {
      front: { delt_lat: ['Side delt', 64, 112, 'L'], delt_ant: ['Front delt', 94, 118, 'R'], pec_up: ['Upper chest', 130, 98, 'R'],
               pec_low: ['Lower chest', 124, 146, 'R'], biceps: ['Biceps', 86, 196, 'L'], forearm: ['Forearm', 86, 270, 'L'],
               abs: ['Abs', 136, 214, 'R'], trap_up: ['Upper traps', 100, 70, 'L'] },
      back:  { delt_lat: ['Side delt', 64, 112, 'L'], delt_post: ['Rear delt', 94, 120, 'R'], triceps: ['Triceps', 86, 196, 'L'],
               lats: ['Lats', 112, 196, 'R'], trap_mid: ['Mid back', 108, 104, 'L'], trap_low: ['Lower traps', 134, 160, 'R'],
               back_low: ['Lower back', 146, 236, 'R'], forearm: ['Forearm', 86, 270, 'L'], trap_up: ['Upper traps', 100, 70, 'L'] }
    },
    lower: {
      front: { quad: ['Quads', 104, 130, 'L'] },
      back:  { glute: ['Glutes', 106, 84, 'L'], ham: ['Hamstrings', 104, 160, 'L'], calf: ['Calves', 150, 262, 'R'], back_low: ['Lower back', 118, 26, 'R'] }
    }
  };
  var LOWER_IDS = { quad: 1, ham: 1, glute: 1, calf: 1 };

  function zoneOf(mus) {
    var all = mus.p.concat(mus.s), i;
    for (i = 0; i < all.length; i++) { if (LOWER_IDS[all[i]]) { return 'lower'; } }
    return 'upper';
  }

  function viewSVG(mus, zone, view) {
    var cls = function (id) { return mus.p.indexOf(id) >= 0 ? ' p' : mus.s.indexOf(id) >= 0 ? ' s' : ''; };
    var regions = (zone === 'upper' ? UPPER : LOWER)[view];
    var out = '<g data-view="' + view + '">';
    out += zone === 'upper' ? '<path class="mus" d="' + UPPER_NECK + '"/>' : '<path class="mus" d="' + LOWER_BASE + '"/>';
    regions.forEach(function (r) {
      out += '<path class="mus' + cls(r[0]) + '" d="' + r[1] + '"/>';
      out += '<path class="mus' + cls(r[0]) + '" transform="translate(320 0) scale(-1 1)" d="' + r[1] + '"/>';
    });
    if (zone === 'upper') {
      out += view === 'front'
        ? '<path class="mline" d="M158 82 Q130 80 100 90"/><path class="mline" d="M162 82 Q190 80 220 90"/>'
        : '<path class="mline" d="M160 62 L160 258"/>';
    } else if (view === 'back') {
      out += '<path class="mline" d="M160 4 L160 112"/>';
    }
    var labels = LAB[zone][view];
    mus.p.forEach(function (id) {
      var l = labels[id];
      if (!l) { return; }
      if (l[3] === 'L') {
        out += '<line class="mlead" x1="' + (l[1] - 2) + '" y1="' + l[2] + '" x2="62" y2="' + l[2] + '"/><text class="mlab" x="2" y="' + (l[2] + 4) + '">' + l[0] + '</text>';
      } else {
        out += '<line class="mlead" x1="' + (320 - l[1]) + '" y1="' + l[2] + '" x2="258" y2="' + l[2] + '"/><text class="mlab" x="318" y="' + (l[2] + 4) + '" text-anchor="end">' + l[0] + '</text>';
      }
    });
    return out + '</g>';
  }

  window.Muscle = {
    // Returns the full <svg> markup (both views; the page shows one at a time).
    svg: function (ex) {
      var zone = zoneOf(ex.mus), h = zone === 'upper' ? 300 : 330;
      return '<svg class="mimg" viewBox="0 0 320 ' + h + '" role="img" aria-label="Muscle diagram for the ' + ex.name + '. Red shows the main muscle worked: ' + ex.mus.main + '.">' +
        viewSVG(ex.mus, zone, 'front') + viewSVG(ex.mus, zone, 'back') + '</svg>';
    }
  };
})();
