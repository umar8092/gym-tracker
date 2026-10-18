/* Gym Workout Tracker UI: hash router + six views. Plain JS, no build step. */
(function () {
  var view = document.getElementById('view');
  var toastEl = document.getElementById('toast');
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  var draft = {};            // exId -> {reps, kg}, survives re-rendering of one exercise
  var calState = null;       // {y, m, sel}
  var toastTimer = 0;

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
  // weights: stored in kg, shown in the unit the person chose (kg or lb)
  var DEF_UNIT = /^en-US$/i.test(navigator.language || '') ? 'lb' : 'kg';
  Stats.setUnit((function () { try { return localStorage.getItem('gymtracker.unit') || DEF_UNIT; } catch (e) { return DEF_UNIT; } })());
  function U() { return Stats.unitName(); }
  function wStr(kg) { return kgStr(Stats.toU(kg)); }
  // quick weights and the long menu, in whichever unit is chosen (the values are kept in kg)
  function quickKg() { return (U() === 'lb' ? [5, 10, 15, 20, 25] : [2.5, 5, 7.5, 10, 12.5]).map(Stats.fromU); }
  function menuKg() { var a = [], step = U() === 'lb' ? 5 : 2.5, max = U() === 'lb' ? 300 : 120; for (var q = step; q <= max; q += step) { a.push(Stats.fromU(q)); } return a; }
  var BAR_NAME = function () { return U() === 'lb' ? '45 lb' : '20 kg'; };
  function kgStr(n) { return Math.abs(n - Math.round(n)) < 0.001 ? String(Math.round(n)) : String(Math.round(n * 10) / 10); }
  function longDate(s) { var d = Store.parse(s); return DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()]; }
  // muscles still to do on a planned multi-muscle day; if the person trained something else instead, the day counts as done
  function leftToday(info) { return info.trained.some(function (m) { return info.plannedAll.indexOf(m) < 0; }) ? [] : info.plannedAll.filter(function (m) { return info.trained.indexOf(m) < 0; }); }
  function mShort(id) { return (Data.MUSCLES[id] && Data.MUSCLES[id].short) || mName(id).slice(0, 3); }
  function mList(a) { return a.map(mName).join(' + '); }
  function mName(id) { return Data.MUSCLES[id] ? Data.MUSCLES[id].name : id; }
  // act = { label, fn }: a button in the toast (Undo). Such a toast stays longer and can be tapped.
  function toast(msg, act) {
    toastEl.textContent = msg; toastEl.classList.toggle('act', !!act);
    if (act) { var b = document.createElement('button'); b.type = 'button'; b.textContent = act.label; b.addEventListener('click', function () { toastEl.classList.remove('on'); act.fn(); }); toastEl.appendChild(b); }
    toastEl.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { toastEl.classList.remove('on'); }, act ? 6000 : 1800);
  }
  function weekStart(s) { var d = Store.parse(s), off = (d.getDay() + 6) % 7; return Store.addDays(s, -off); }
  function visibleEx(muscle) {
    var o = Store.order(muscle), list = Data.exercisesFor(muscle).filter(function (e) { return !Store.isHidden(e.id); });
    return list.map(function (e, i) { return [o.indexOf(e.id) < 0 ? 1e3 + i : o.indexOf(e.id), e]; }).sort(function (a, b) { return a[0] - b[0]; }).map(function (x) { return x[1]; });
  }
  function moveEx(muscle, id, by) {
    var ids = visibleEx(muscle).map(function (e) { return e.id; }), i = ids.indexOf(id), j = i + by;
    if (i < 0 || j < 0 || j >= ids.length) { return -1; }
    ids.splice(j, 0, ids.splice(i, 1)[0]); Store.setOrder(muscle, ids); return j;
  }
  function swapSheet(muscle, id) {
    var spare = Data.exercisesFor(muscle).filter(function (e) { return e.id !== id; });
    openSheet('<h2>Swap this exercise</h2><p class="sub">Replace <b>' + esc(Data.byId[id].name) + '</b> with another ' + esc(mName(muscle).toLowerCase()) + ' exercise. The new one takes its place in the order; one already in your list just trades places. Your logged history is kept.</p>' +
      (spare.length ? '<ul class="swap-list">' + spare.map(function (e) { return '<li><button type="button" class="btn block" data-act="swap-go" data-id="' + id + '" data-to="' + e.id + '"><b>' + esc(e.name) + '</b><span class="sub"> ' + esc(e.equip) + (Store.isHidden(e.id) ? '' : ', trade places') + '</span></button></li>'; }).join('') + '</ul>' : '') + '<p class="sub">Want something else? <a class="link" href="#/plan/' + muscle + '" data-act="sheet-close">Search the library or add your own</a>.</p>');
  }

  /* =========================================================  SESSION TIMER + SCREEN AWAKE  */
  // The session clock is a start time kept on the device, so it keeps running if the app is closed or the phone locks.
  var Sess = {
    get: function () { try { var o = JSON.parse(localStorage.getItem('gymtracker.session')); return o && o.d === Store.today() ? o : null; } catch (e) { return null; } },
    start: function () { var o = Sess.get(); if (o && o.end) { delete o.end; try { localStorage.setItem('gymtracker.session', JSON.stringify(o)); } catch (e) {} } if (!o) { try { localStorage.setItem('gymtracker.session', JSON.stringify({ d: Store.today(), start: Date.now() })); } catch (e) {} } },
    end: function () { var o = Sess.get(); if (o && !o.end) { o.end = Date.now(); try { localStorage.setItem('gymtracker.session', JSON.stringify(o)); } catch (e) {} } },
    ms: function () { var o = Sess.get(); return o ? (o.end || Date.now()) - o.start : 0; },
    text: function () { var m = Math.floor(Sess.ms() / 60000), sec = Math.floor(Sess.ms() / 1000) % 60; return Math.floor(m / 60) ? Math.floor(m / 60) + ':' + (m % 60 < 10 ? '0' : '') + (m % 60) + ':' + (sec < 10 ? '0' : '') + sec : m + ':' + (sec < 10 ? '0' : '') + sec; }
  };
  var sessTick = 0, wakeLock = null;
  function startSessTick() {
    clearInterval(sessTick); var el = document.getElementById('sess-t'); if (!el) { return; }
    var paint = function () { el.textContent = Sess.text(); }; paint(); sessTick = setInterval(paint, 1000);
  }
  function keepAwake(on) {
    var want = on && localStorage.getItem('gymtracker.awake') !== 'off' && 'wakeLock' in navigator;
    if (!want) { if (wakeLock) { wakeLock.release().catch(function () {}); wakeLock = null; } return; }
    if (wakeLock) { return; }
    navigator.wakeLock.request('screen').then(function (l) { wakeLock = l; l.addEventListener('release', function () { wakeLock = null; }); }).catch(function () {});
  }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && route().name === 'm') { keepAwake(true); } });

  /* =========================================================  SHEET (dialog) + SHARE CARD  */
  var sheetOpener = null;
  function openSheet(html, cls) {
    closeSheet(true); sheetOpener = document.activeElement;
    var bg = document.createElement('div'); bg.id = 'sheet'; bg.className = 'sheet-bg';
    bg.innerHTML = '<div class="sheet ' + (cls || '') + '" role="dialog" aria-modal="true" aria-label="Details"><button class="sheet-x" type="button" data-act="sheet-close" aria-label="Close">×</button><div class="sheet-body">' + html + '</div></div>';
    bg.addEventListener('click', function (e) { if (e.target === bg) { closeSheet(); } });
    document.body.appendChild(bg); document.body.classList.add('sheet-open');
    var f = bg.querySelector('button:not(.sheet-x), a, input'); (f || bg.querySelector('.sheet-x')).focus({ preventScroll: true });
    return bg;
  }
  function closeSheet(quiet) {
    var bg = document.getElementById('sheet'); if (!bg) { return; }
    bg.parentNode.removeChild(bg); document.body.classList.remove('sheet-open');
    if (!quiet && sheetOpener && sheetOpener.focus) { try { sheetOpener.focus({ preventScroll: true }); } catch (e) {} }
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeSheet(); } });

  var SITE = 'https://umar8092.github.io/gym-tracker/';
  // what a share contains: a title, a few big numbers, some lines. Used for the image and for the text.
  function weekShare() {
    var t = Store.today(), ws = weekStart(t), we = Store.addDays(ws, 6), logs = Store.allLogs().filter(function (l) { return l.d >= ws && l.d <= we; }), days = {}, prs = [], ms = [];
    logs.forEach(function (l) { days[l.d] = 1; if (ms.indexOf(l.m) < 0) { ms.push(l.m); } var pr = Stats.prFor(l, exLogs(l.e)); if (pr && Data.byId[l.e]) { prs.push(Data.byId[l.e].name + ' ' + (l.kg > 0 ? wStr(l.kg) + ' ' + U() + ' × ' + l.reps : l.reps + ' reps')); } });
    var d1 = Store.parse(ws), d2 = Store.parse(we), range = d1.getDate() + ' ' + MONTHS[d1.getMonth()].slice(0, 3) + ' to ' + d2.getDate() + ' ' + MONTHS[d2.getMonth()].slice(0, 3);
    return { title: 'My week', sub: range, badge: prs.length ? prs.length + (prs.length === 1 ? ' new PR' : ' new PRs') : '', big: ms.length ? ms.map(mName).join(' + ') : 'Rest week',
      stats: [[Object.keys(days).length, 'Sessions'], [logs.length, 'Sets'], [Math.round(Store.volume(logs)).toLocaleString(), U() + ' lifted'], [Stats.calories(logs, Store.currentKg()), 'Kcal (est.)']],
      lines: (prs.length ? ['New PRs: ' + prs.slice(0, 3).join(', ')] : []).concat([Store.streak() + '-day streak', 'Weight ' + wStr(Store.currentKg()) + ' ' + U() + ', goal ' + wStr(Store.profile().goalKg) + ' ' + U()]) };
  }
  function workoutShare(muscle) {
    var t = Store.today(), logs = Store.logsOn(t).filter(function (l) { return l.m === muscle; }), ids = [], prs = [];
    logs.forEach(function (l) { if (ids.indexOf(l.e) < 0) { ids.push(l.e); } var pr = Stats.prFor(l, exLogs(l.e)); if (pr && Data.byId[l.e]) { prs.push(Data.byId[l.e].name + ' ' + wStr(l.kg) + ' ' + U() + ' × ' + l.reps); } });
    var mins = Sess.get() && Sess.ms() > 60000 ? Math.round(Sess.ms() / 60000) : 0;
    return { title: longDate(t), sub: 'Workout done', big: mName(muscle) + ' day', badge: prs.length ? prs.length + (prs.length === 1 ? ' new PR' : ' new PRs') : '',
      stats: [[logs.length, 'Sets'], [Math.round(Store.volume(logs)).toLocaleString(), U() + ' lifted'], [mins || ids.length, mins ? 'Minutes' : 'Exercises'], [Stats.calories(logs, Store.currentKg()), 'Kcal (est.)']],
      lines: (prs.length ? ['New PRs: ' + prs.slice(0, 3).join(', ')] : []).concat(ids.slice(0, 5).map(function (id) { return Data.byId[id] ? Data.byId[id].name : id; })) };
  }
  // a personal-record card for one logged set
  function prShare(exId, setId) {
    var ex = Data.byId[exId], set = Store.allLogs().filter(function (l) { return l.id === setId; })[0] || bestSet(exLogs(exId).filter(function (l) { return !l.del; }));
    if (!ex || !set) { return { title: 'Record', sub: '', big: 'New PR', stats: [], lines: [] }; }
    return { title: longDate(set.d), sub: 'Personal record', badge: 'New PR', big: ex.name,
      stats: set.kg > 0 ? [[wStr(set.kg), U()], [set.reps, set.reps === 1 ? 'Rep' : 'Reps'], [kgStr(Stats.toU(Stats.epley(set.kg, set.reps))), 'Est. one-rep max (' + U() + ')'], [Store.streak(), 'Day streak']] : [[set.reps, 'Reps'], [Store.streak(), 'Day streak']],
      lines: [mName(ex.muscle) + ' day', 'Beat my last best. Next target: a little more.'] };
  }
  function shareText(d) {
    return ['🏋️ ' + d.title + (d.sub ? ' · ' + d.sub : ''), (d.badge ? '🏆 ' + d.badge + ': ' : '') + d.big, ''].concat(d.stats.map(function (x) { return '• ' + x[0] + ' ' + x[1].toLowerCase(); }), [''], d.lines.map(function (l) { return '▸ ' + l; }), ['', 'Gym Workout Tracker', SITE]).join('\n');
  }
  var cardLogo = null;   // the flexing-figure logo as an image, made once
  function loadLogo() {
    if (cardLogo) { return Promise.resolve(cardLogo); }
    return new Promise(function (res) {
      var svg = FLEX.replace('<svg class="flex-logo"', '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="240"').replace(/aria-label="[^"]*" focusable="false"/, '');
      var im = new Image(); im.onload = function () { cardLogo = im; res(im); }; im.onerror = function () { res(null); };
      im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
  }
  // fmt: 'post' = 1080x1350 (Instagram feed), 'story' = 1080x1920 (Stories / Status)
  function drawCard(d, fmt) {
    var W = 1080, H = fmt === 'story' ? 1920 : 1350, c = document.createElement('canvas'); c.width = W; c.height = H; var x = c.getContext('2d'), A = 'Anton, Impact, "Arial Narrow", sans-serif', B = 'Archivo, system-ui, sans-serif', story = fmt === 'story';
    x.fillStyle = '#0A0A0B'; x.fillRect(0, 0, W, H);
    // faint plate stripes for texture
    x.fillStyle = '#101012'; for (var i = 0; i < 6; i++) { x.fillRect(W - 90 - i * 46, story ? 140 : 120, 26, H); }
    var top = story ? 140 : 120; x.fillStyle = '#E5202E'; x.fillRect(0, 0, W, top);
    x.fillStyle = '#fff'; x.font = '60px ' + A; x.textBaseline = 'middle'; x.fillText(d.title.toUpperCase(), 60, top / 2 + 2);
    x.textAlign = 'right'; x.font = '800 30px ' + B; x.fillText((d.sub || '').toUpperCase(), W - 60, top / 2 + 2); x.textAlign = 'left';
    var y0 = top + (story ? 150 : 90);
    if (d.badge) { x.fillStyle = '#D9A93A'; x.font = '800 34px ' + B; var bw = x.measureText(d.badge.toUpperCase()).width + 48; x.fillRect(60, y0 - 52, bw, 64); x.fillStyle = '#0A0A0B'; x.textBaseline = 'middle'; x.fillText(d.badge.toUpperCase(), 84, y0 - 19); y0 += 40; }
    var size = story ? 230 : 190; x.fillStyle = '#F4F4F2'; var words = d.big.toUpperCase();
    do { x.font = size + 'px ' + A; size -= 6; } while (x.measureText(words).width > W - 120 && size > 60);
    x.textBaseline = 'alphabetic'; x.fillText(words, 60, y0 + size * 0.95);
    var sy = y0 + size * 0.95 + (story ? 110 : 70), box = story ? 270 : 210;
    d.stats.forEach(function (s, i) {
      var cx = 60 + (i % 2) * 500, cy = sy + Math.floor(i / 2) * (box + 40);
      x.fillStyle = '#131315'; x.fillRect(cx, cy, 460, box); x.strokeStyle = '#2C2C31'; x.lineWidth = 2; x.strokeRect(cx, cy, 460, box);
      x.fillStyle = '#F4F4F2'; x.font = (story ? 150 : 120) + 'px ' + A; x.fillText(String(s[0]), cx + 30, cy + box - (story ? 100 : 75));
      x.fillStyle = '#9C9CA5'; x.font = '800 28px ' + B; x.fillText(String(s[1]).toUpperCase(), cx + 32, cy + box - 26);
    });
    var ly = sy + Math.ceil(d.stats.length / 2) * (box + 40) + 30;
    if (d.lines.length) { x.fillStyle = '#D9A93A'; x.fillRect(60, ly - 36, 8, Math.min(4, d.lines.length) * 48 + 4); }
    x.font = '700 36px ' + B; d.lines.slice(0, story ? 6 : 4).forEach(function (l) { x.fillStyle = '#F4F4F2'; var t = l; while (x.measureText(t).width > W - 160 && t.length > 8) { t = t.slice(0, -2); } x.fillText(t === l ? l : t + '…', 92, ly); ly += 48; });
    x.fillStyle = '#E5202E'; x.fillRect(0, H - 120, W, 120);
    x.fillStyle = '#fff'; x.font = '60px ' + A; x.textBaseline = 'middle'; x.fillText('GYM WORKOUT TRACKER', 60, H - 58);
    if (cardLogo) { var lw = 230, lh = lw * 0.4; x.drawImage(cardLogo, W - lw - 50, H - 120 + (120 - lh) / 2, lw, lh); }
    return c;
  }
  var shareCurrent = null;
  function openShare(d, fmt) {
    fmt = fmt || 'post'; shareCurrent = { d: d, text: shareText(d), blob: null, fmt: fmt };
    var load = Promise.all([document.fonts && document.fonts.load ? Promise.all([document.fonts.load('60px Anton'), document.fonts.load('800 30px Archivo')]).catch(function () {}) : 0, loadLogo()]);
    var body = '<h2>' + (d.badge ? 'Share your record' : 'Share') + '</h2><p class="sub">Made for Instagram: pick Post or Story, then Share or Save image.</p><div class="modes" role="group" aria-label="Card size" style="grid-template-columns:repeat(2,1fr)">' +
      [['post', 'Post 4:5'], ['story', 'Story 9:16']].map(function (f) { return '<button type="button" class="chip" data-act="share-fmt" data-v="' + f[0] + '" aria-pressed="' + (fmt === f[0]) + '">' + f[1] + '</button>'; }).join('') + '</div>' +
      '<div class="share-prev" id="share-prev"><p class="muted">Making your card…</p></div><div class="btns share-btns"><button class="btn primary" type="button" data-act="share-go">Share</button><button class="btn" type="button" data-act="share-save">Save image</button><button class="btn" type="button" data-act="share-copy">Copy text</button></div>';
    if (document.getElementById('sheet')) { var sb = document.querySelector('#sheet .sheet-body'); sb.innerHTML = body; } else { openSheet(body, 'sheet-share'); }
    load.then(function () {
      var c = drawCard(d, fmt), prev = document.getElementById('share-prev'); if (!prev) { return; }
      c.toBlob(function (b) { shareCurrent.blob = b; var im = new Image(); im.alt = 'Preview of your share card'; im.src = URL.createObjectURL(b); prev.innerHTML = ''; prev.appendChild(im); }, 'image/png');
    });
  }
  function doShare(kind) {
    var cur = shareCurrent; if (!cur) { return; }
    var file = cur.blob && typeof File !== 'undefined' ? new File([cur.blob], 'gym-workout.png', { type: 'image/png' }) : null;
    if (kind === 'save') { if (!cur.blob) { toast('Still making the card'); return; } var a = document.createElement('a'); a.href = URL.createObjectURL(cur.blob); a.download = 'gym-workout.png'; document.body.appendChild(a); a.click(); a.remove(); toast('Image saved'); return; }
    if (kind === 'copy') { if (navigator.clipboard) { navigator.clipboard.writeText(cur.text).then(function () { toast('Text copied'); }, function () { toast('Could not copy'); }); } else { toast('Copy is not available here'); } return; }
    if (navigator.share) {
      var data = file && navigator.canShare && navigator.canShare({ files: [file] }) ? { files: [file], text: cur.text } : { text: cur.text };
      navigator.share(data).catch(function () {}); return;
    }
    doShare('save'); if (navigator.clipboard) { navigator.clipboard.writeText(cur.text).catch(function () {}); }
  }

  var APP_VERSION = 'gym-v34';   // keep equal to VERSION in sw.js (tests/version.test.js checks it)
  function deviceInfo() { var ua = navigator.userAgent || '', m = /(iPhone|iPad|Android[^;)]*|Windows|Macintosh|Linux)/.exec(ua), b = /(Edg|CriOS|FxiOS|Firefox|Chrome|Safari)\/?([\d.]*)/.exec(ua); return (m ? m[1] : 'device') + ', ' + (b ? b[1] + ' ' + b[2].split('.')[0] : 'browser') + ', screen ' + screen.width + 'x' + screen.height + ', ' + (Install.standalone() ? 'installed app' : 'in browser'); }

  /* =========================================================  EXPORT, REMINDERS, DELETE  */
  function download(name, text, type) { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500); }
  function csvCell(v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function exportCSV(kind) {
    var rows;
    if (kind === 'weights') { rows = [['date', 'weight_kg', 'weight_lb']].concat(Store.weights().map(function (w) { return [w.d, Math.round(w.kg * 100) / 100, Math.round(w.kg * 2.20462 * 10) / 10]; })); }
    else {
      var n = {}; rows = [['date', 'muscle', 'exercise', 'set', 'reps', 'weight_kg', 'weight_lb']];
      Store.allLogs().slice().sort(function (a, b) { return a.ts - b.ts; }).forEach(function (l) { var k = l.d + l.e; n[k] = (n[k] || 0) + 1; rows.push([l.d, mName(l.m), Data.byId[l.e] ? Data.byId[l.e].name : l.e, n[k], l.reps, Math.round(l.kg * 100) / 100, Math.round(l.kg * 2.20462 * 10) / 10]); });
    }
    download('gym-workout-' + kind + '-' + Store.today() + '.csv', '\ufeff' + rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n'), 'text/csv;charset=utf-8');
  }
  // an .ics file: one weekly repeating event per training day, floating local time, with a reminder 15 minutes before
  function icsFile(hhmm) {
    var sc = Store.schedule(), codes = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'], t = Store.today(), hh = hhmm.split(':'), pad = function (n) { return (n < 10 ? '0' : '') + n; }, now = new Date(), stamp = now.getUTCFullYear() + pad(now.getUTCMonth() + 1) + pad(now.getUTCDate()) + 'T' + pad(now.getUTCHours()) + pad(now.getUTCMinutes()) + '00Z';
    var ev = Object.keys(sc).map(function (d) {
      d = +d; var date = Store.parse(t), add = (d - date.getDay() + 7) % 7; date.setDate(date.getDate() + add);
      var ds = date.getFullYear() + pad(date.getMonth() + 1) + pad(date.getDate()), end = pad((+hh[0] + 1) % 24) + hh[1];
      return ['BEGIN:VEVENT', 'UID:gym-' + codes[d] + '@gym-workout-tracker', 'DTSTAMP:' + stamp, 'DTSTART:' + ds + 'T' + hh[0] + hh[1] + '00', 'DTEND:' + ds + 'T' + end + '00', 'RRULE:FREQ=WEEKLY;BYDAY=' + codes[d],
        'SUMMARY:Gym: ' + sc[d].map(mName).join(' + '), 'DESCRIPTION:Open Gym Workout Tracker: ' + SITE + '#/today', 'URL:' + SITE + '#/today', 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Gym time', 'TRIGGER:-PT15M', 'END:VALARM', 'END:VEVENT'].join('\r\n');
    });
    return 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Gym Workout Tracker//EN\r\nCALSCALE:GREGORIAN\r\n' + ev.join('\r\n') + '\r\nEND:VCALENDAR\r\n';
  }
  function deleteSheet() {
    var me = Store.user();
    openSheet('<h2>Delete my data</h2><p class="sub">This removes <b>everything</b> for <b>' + esc(me) + '</b> from the cloud (workouts, weights, settings) and from this device, then signs you out. It cannot be undone, and other devices keep their own local copy until they sync.</p>' +
      '<div class="fld" style="margin-top:14px"><label for="del-n">Type your username to confirm</label><input id="del-n" class="text-in" autocapitalize="none" autocomplete="off" spellcheck="false"></div><p class="form-err" id="del-err" role="alert"></p>' +
      '<div class="btns"><button class="btn danger-btn" type="button" data-act="delete-go">Delete everything</button><button class="link" type="button" data-act="sheet-close">Cancel</button></div>', 'sheet-delete');
  }

  /* =========================================================  INSTALL AS AN APP  */
  var Install = {
    ua: navigator.userAgent || '',
    standalone: function () { return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; },
    ios: function () { return /iPad|iPhone|iPod/.test(Install.ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); },
    android: function () { return /Android/i.test(Install.ua); },
    firefox: function () { return /Firefox|FxiOS/.test(Install.ua); },
    mobile: function () { return Install.ios() || Install.android(); },
    dismissed: function () { try { var d = +localStorage.getItem('gymtracker.install.no'); return d && Date.now() - d < 14 * 864e5; } catch (e) { return false; } },
    available: function () { return !Install.standalone() && !(Install.firefox() && !Install.mobile()); },   // desktop Firefox cannot install web apps
    steps: function () {
      if (Install.ios()) { return ['Tap the <b>Share</b> button (the square with an arrow) at the bottom of Safari.', 'Scroll down and tap <b>Add to Home Screen</b>.', 'Tap <b>Add</b>. The app appears on your home screen.']; }
      if (Install.android()) { return ['Tap the <b>⋮ menu</b> at the top right of Chrome.', 'Tap <b>Install app</b> (or <b>Add to Home screen</b>).', 'Tap <b>Install</b>. The app appears with your other apps.']; }
      if (/Safari/.test(Install.ua) && !/Chrome|Chromium|Edg/.test(Install.ua)) { return ['In the menu bar choose <b>File</b>.', 'Choose <b>Add to Dock</b>.', 'Click <b>Add</b>. Open it from your Dock like any app.']; }
      return ['Look for the <b>install icon</b> at the right end of the address bar (a small screen with an arrow), or open the <b>⋮ menu</b>.', 'Choose <b>Install Gym Workout Tracker</b>.', 'Click <b>Install</b>. It opens in its own window and appears in your apps.'];
    }
  };
  function installSheet() {
    var steps = Install.steps(), can = !!window.__installEvt;
    var where = Install.ios() || Install.android() ? 'home screen' : 'computer';
    openSheet('<h2>Turn this into an app</h2><p class="sub">Add Gym Workout Tracker to your ' + where + '. It opens full screen like any app, loads faster, and keeps working without internet.</p>' +
      (can ? '<button class="btn primary block" type="button" data-act="install-now" style="margin-top:14px">Install now</button><p class="lab" style="margin-top:18px"><span>Or do it by hand</span></p>' : '<p class="lab" style="margin-top:16px"><span>3 quick steps</span></p>') +
      '<ol class="istep">' + steps.map(function (t, i) { return '<li><span class="n">' + (i + 1) + '</span><span>' + t + '</span></li>'; }).join('') + '</ol>' +
      '<p class="muted small-note">Your workouts stay the same. Nothing to download from an app store.</p><div class="btns"><button class="link" type="button" data-act="install-later">Not now</button></div>', 'sheet-install');
  }
  function installIcon() { return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2.2"/><path d="M12 8v6M9.5 11.5L12 14l2.5-2.5M10.5 18.5h3"/></svg>'; }
  // a small round button on the main pages, plus a Home card; both go away once installed or dismissed
  function installFab() {
    var fab = document.getElementById('install-fab'), show = Install.available() && /^(home|today|calendar|plan)$/.test(route().name) && !document.body.classList.contains('gated');
    if (!show) { if (fab) { fab.hidden = true; } return; }
    if (!fab) { fab = document.createElement('button'); fab.id = 'install-fab'; fab.type = 'button'; fab.className = 'install-fab'; fab.setAttribute('data-act', 'install-open'); fab.setAttribute('aria-label', 'Install the app'); fab.innerHTML = installIcon() + '<span>Get the app</span>'; document.body.appendChild(fab); }
    fab.hidden = false;
  }
  function installCard() {
    if (!Install.available() || Install.dismissed()) { return ''; }
    return '<section class="d-card install-card"><span class="ic">' + installIcon() + '</span><div><b>Turn this into an app</b><p>Add it to your ' + (Install.mobile() ? 'home screen' : 'computer') + ' in 3 quick steps. Opens full screen and works offline.</p></div><button class="btn small" type="button" data-act="install-open">Show me how</button></section>';
  }
  window.addEventListener('appinstalled', function () { window.__installEvt = null; closeSheet(true); installFab(); toast('Installed. Open it from your home screen.'); });

  /* =========================================================  3D ON DEMAND  */
  // The 3D engine, the model and its textures (about 1.8 MB) are only fetched when someone opens a form guide.
  var Engine = window.Engine || { unmountAll: function () {}, redraw: function () {}, mount: function () {} };   // the old 2D engine is gone; calls stay harmless
  var A3D = [["vendor/three.module.min.js", 691648], ["vendor/addons/loaders/GLTFLoader.js", 110273], ["vendor/addons/utils/BufferGeometryUtils.js", 31768], ["vendor/addons/utils/SkeletonUtils.js", 8802], ["vendor/addons/environments/RoomEnvironment.js", 3606], ["models/Superhero_Male_FullBody.gltf", 20897], ["models/Superhero_Male_FullBody.bin", 565116], ["models/T_Hair_1_Normal.jpg", 30983], ["models/T_Hair_1_BaseColor.jpg", 20631], ["models/T_Eye_Normal.png", 15099], ["models/T_Eye_Brown.png", 35958], ["models/T_Superhero_Male_Normal.jpg", 82577], ["models/T_Superhero_Male_Light.jpg", 43933], ["models/T_Superhero_Male_Roughness.jpg", 55418]];   // files the 3D guide needs, with their sizes, for the loading percentage
  var p3d = null, subs3d = [];
  function fetchCount(url, tick) {
    return fetch(url).then(function (r) {
      if (!r.ok) { throw new Error('HTTP ' + r.status); }
      if (!r.body || !r.body.getReader) { return r.arrayBuffer().then(function (b) { tick(b.byteLength); }); }
      var rd = r.body.getReader();
      return (function pump() { return rd.read().then(function (x) { if (x.done) { return; } tick(x.value.length); return pump(); }); })();
    });
  }
  function load3D(onProgress) {
    if (window.Engine3D) { if (onProgress) { onProgress(1); } return Promise.resolve(); }
    if (onProgress) { subs3d.push(onProgress); }
    if (p3d) { return p3d; }
    var total = 0, done = 0; A3D.forEach(function (a) { total += a[1]; });
    var tick = function (n) { done += n; var f = Math.min(0.9, done / total * 0.9); subs3d.forEach(function (fn) { fn(f); }); };
    p3d = Promise.all(A3D.map(function (a) { return fetchCount(a[0], tick); }))
      .then(function () { subs3d.forEach(function (fn) { fn(0.92); }); return import(new URL('js/figure3d.js', document.baseURI).href); })
      .then(function () { subs3d.forEach(function (fn) { fn(0.98); }); })
      .catch(function (e) { p3d = null; subs3d = []; throw e; });
    return p3d;
  }
  function loaderHTML() { return '<div class="load3d" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-label="Loading the 3D figure"><b class="pct num">0%</b><span>Loading 3D figure</span><div class="lbar"><i></i></div><small>Only loaded when you open a guide. It is saved for next time.</small></div>'; }
  function setLoader(el, f) { if (!el) { return; } var p = Math.round(f * 100); el.setAttribute('aria-valuenow', p); el.querySelector('.pct').textContent = p + '%'; el.querySelector('.lbar i').style.width = p + '%'; }
  function saveData() { return !!(navigator.connection && navigator.connection.saveData); }

  /* =========================================================  TODAY  */
  var QUOTES = [
    'Small steps every day add up to big changes.',
    'You do not have to be extreme, just consistent.',
    'The only bad workout is the one that did not happen.',
    'Discipline is doing it when you do not feel like it.',
    'Strong is built one rep at a time.',
    'Progress, not perfection.',
    'Show up today. Future you will say thanks.',
    'It never gets easier, you just get stronger.',
    'Your only competition is who you were yesterday.',
    'Sweat now, shine later.',
    'A little more than last time is still progress.',
    'Motivation gets you started. Habit keeps you going.',
    'Rest is part of the plan, not a break from it.',
    'Lift with control. The weight will follow.',
    'Do it for the person you are becoming.',
    'Consistency beats intensity.',
    'Today counts, even if it is only a short session.',
    'Train hard, recover well, repeat.',
    'One more good set.',
    'Results come from the days nobody sees.',
    'Start where you are. Use what you have.',
    'Be patient. Muscle takes months, not days.',
    'The hardest rep is the first one through the door.',
    'Make it a habit, not a decision.',
    'Good form first, heavy weight second.',
    'You are one workout away from a better mood.',
    'Every expert was once a beginner under the bar.',
    'Fuel it, lift it, rest it.',
    'Respect the process.',
    'Better than yesterday.',
    'Strength does not come from what you can do, it comes from overcoming what you thought you could not.',
    'Take care of your body. It is the only place you have to live.',
    'Eat well, sleep well, lift well.',
    'The pump fades, the progress stays.',
    'Do not wish for it. Work for it.',
    'Every rep is a vote for the person you want to be.',
    'Slow progress is still progress.',
    'Warm up, work hard, cool down, repeat.',
    'Win the day.',
    'You will never regret a workout you finished.',
    'Fall in love with the process.',
    'Earn your rest day.',
    'Lighter weight with perfect form beats heavier with sloppy form.',
    'Keep showing up.',
    'Strong body, calm mind.',
    'Pain is temporary. Quitting lasts.',
    'Don\'t count the reps. Make the reps count.',
    'Your body can stand almost anything. It\'s your mind you have to convince.',
    'Sore today, strong tomorrow.',
    'If it was easy, everyone would do it.',
    'Champions train when they are tired.',
    'Excuses burn zero calories.',
    'The iron never lies.',
    'Lift heavy things, put them down, feel better.',
    'Today\'s effort is tomorrow\'s strength.',
    'Be stronger than your excuses.',
    'Progress is quiet. Keep going.',
    'Turn the doubt into one more rep.',
    'Nobody ever regretted finishing the set.',
    'The first week is a decision, the first month is a habit.',
    'No shortcuts, only work.',
    'Strong people are made in the quiet hours.',
    'Chase the feeling after the workout.',
    'Your future body is built in today\'s session.',
    'Hard work beats talent when talent does not train.',
    'A good session starts with showing up.',
    'Do something today your future self will thank you for.',
    'Stay patient. Stay consistent. Stay lifting.',
    'Failure is just a heavy set you will hit next time.',
    'Mind over weights.',
    'Earn it. Then rest.',
    'Don\'t stop when it hurts. Stop when you are done.',
    'Great things are lifted one rep at a time.',
    'Eat like you train, train like you mean it.',
    'Little by little, a little becomes a lot.',
    'Be proud of every session, however small.',
    'Wake up. Warm up. Work up.',
    'Form first. Ego last.',
    'The bar does not care how you feel. Lift anyway.',
    'It is a good day to get a little stronger.',
    'Make the hard days count.',
    'Train today, thank yourself later.',
    'Believe in the sets you have not done yet.',
    'Your streak is made of ordinary days.',
    'Leave nothing in the tank, then recover fully.',
    'Do not compare your chapter one to someone\'s chapter twenty.',
    'Build the body you will want at fifty.',
    'One workout at a time, one day at a time.',
    'Quiet confidence is made under the bar.',
    'Strength is a skill. Practise it.',
    'Consistency is the quiet superpower.',
    'Today you are lifting more than weights.',
    'Be the reason you do not skip leg day.',
    'Rest, eat, sleep, lift. Repeat.',
    'Your only job today is the next set.',
    'Heavy is relative. Progress is personal.',
    'Lift like the rack is watching.',
    'Don\'t wait for motivation. Build the habit.',
    'Show up tired. Leave proud.',
    'You are one session closer than yesterday.',
    'Strong is a decision you make again each day.',
    'Own the warm-up, own the session.'];
  // one quote card, shuffled once per visit, advancing every 15 seconds or on tap; the colour changes with each quote
  var quoteOrder = null, quoteAt = 0, quoteTimer = 0;
  function shuffled() { var a = QUOTES.map(function (q, i) { return i; }), i, j, t; for (i = a.length - 1; i > 0; i--) { j = Math.floor(Math.random() * (i + 1)); t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function quoteHTML() {
    if (!quoteOrder) { quoteOrder = shuffled(); }
    return '<button type="button" class="d-card d-quote q' + (quoteAt % 3) + '" data-act="quote" aria-label="Motivation quote, tap for another"><p class="quote">“' + QUOTES[quoteOrder[quoteAt % quoteOrder.length]] + '”</p></button>';
  }
  function nextQuote() {
    var card = document.querySelector('.d-quote'); if (!card) { return; }
    quoteAt++; var p = card.querySelector('.quote');
    var swap = function () { p.textContent = '“' + QUOTES[quoteOrder[quoteAt % quoteOrder.length]] + '”'; card.className = 'd-card d-quote q' + (quoteAt % 3); p.style.opacity = ''; };
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) { swap(); } else { p.style.opacity = '0'; setTimeout(swap, 220); }
  }
  function startQuotes() { clearInterval(quoteTimer); if (document.querySelector('.d-quote')) { quoteTimer = setInterval(function () { if (document.visibilityState === 'visible') { nextQuote(); } }, 15000); } }

  /* ---------- fight-card helpers ---------- */
  // heaviest-looking set of a list (by estimated max, reps for bodyweight)
  function bestSet(sets) { var b = null; sets.forEach(function (s) { if (!b || (s.kg > 0 || b.kg > 0 ? Stats.epley(s.kg, s.reps) > Stats.epley(b.kg, b.reps) : s.reps > b.reps)) { b = s; } }); return b; }
  function setText(s) { return s ? (s.kg > 0 ? s.reps + ' × ' + wStr(s.kg) : s.reps + ' reps') : '—'; }
  function thumbHTML(ex, cls) {
    return '<span class="thumb ' + (cls || '') + '">' + (ex.custom || ex.noimg || saveData() ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h18M6 7v10M18 7v10M9 9v6M15 9v6"/></svg>' : '<img src="img/ex/' + ex.id + '.webp" alt="" loading="lazy" decoding="async">') + '</span>';
  }
  // result of the last fight against the one before it, as a chip: Won last / Draw / Lost last / Split / Rematch / Debut
  function lastResult(ex, t) {
    var ss = Stats.sessions(ex.id, exLogs(ex.id)).filter(function (x) { return x.date < t; }), n = ss.length;
    if (!n) { return { cls: 'x', txt: 'Debut' }; }
    if (n === 1) { return { cls: 'x', txt: 'Rematch' }; }
    var v = Stats.compare(ss[n - 1], ss[n - 2]).verdict;
    return v === 'up' ? { cls: 'w', txt: 'Won last' } : v === 'down' ? { cls: 'l', txt: 'Lost last' } : v === 'mixed' ? { cls: 'd', txt: 'Split' } : { cls: 'd', txt: 'Draw' };
  }
  function boutRow(ex, i, t, muscle) {
    var last = Store.lastSession(ex.id, t), r = lastResult(ex, t), top = last ? bestSet(last.sets) : null;
    return '<a class="bout" href="#/m/' + muscle + '"><span class="n">' + (i + 1) + '</span>' + thumbHTML(ex) + '<span><b class="nm">' + esc(ex.name) + '</b><small>' + ex.sets + ' rounds · ' + esc(ex.reps) + ' reps · ' + ex.equip + '</small></span>' +
      '<span class="lt">Last time<s>' + (last ? setText(top) : 'none') + '</s></span><span class="res ' + r.cls + '">' + r.txt + '</span></a>';
  }
  // exercises fought today: the chip compares today with the time before
  function doneRow(ex, i, t, muscle) {
    var ss = Stats.sessions(ex.id, exLogs(ex.id)), cur = ss.filter(function (x) { return x.date === t; })[0], prev = ss.filter(function (x) { return x.date < t; }).pop();
    var c = prev ? Stats.compare(cur, prev).verdict : '', r = !prev ? { cls: 'x', txt: 'Debut' } : c === 'up' ? { cls: 'w', txt: 'Won' } : c === 'down' ? { cls: 'l', txt: 'Lost' } : c === 'mixed' ? { cls: 'd', txt: 'Split' } : { cls: 'd', txt: 'Draw' };
    return '<a class="bout" href="#/m/' + muscle + '"><span class="n">' + (i + 1) + '</span>' + thumbHTML(ex) + '<span><b class="nm">' + esc(ex.name) + '</b><small>' + cur.n + (cur.n === 1 ? ' round' : ' rounds') + ' today</small></span><span class="lt">Top round<s>' + setText(bestSet(cur.sets)) + '</s></span><span class="res ' + r.cls + '">' + r.txt + '</span></a>';
  }
  function nextCard(t) {
    for (var i = 1; i <= 7; i++) { var ds = Store.addDays(t, i), m = Data.planFor(Store.parse(ds).getDay()); if (m) { return { date: ds, muscle: m }; } }
    return null;
  }

  // tale of the tape: you against your goal, plus your fight record
  function tapeHTML(t) {
    var p = Store.profile(), cur = Store.currentKg(), tr = Stats.trend(Store.weights(), p.goalKg, t), rec = Stats.record(Store.allLogs());
    var total = p.startKg - p.goalKg, pct = total > 0 ? Math.max(0, Math.min(1, (p.startKg - cur) / total)) : 0, row = function (l, a, b) { return '<div class="row"><div>' + l + '</div><b>' + a + '</b><b>' + (b || '') + '</b></div>'; };
    return '<div class="lab"><span>Tale of the tape</span><span>Today vs goal</span></div><div class="hd"><div>&nbsp;</div><span>' + esc(Store.user()) + '</span><span>Goal</span></div>' +
      row('Weight ' + U(), wStr(cur), wStr(p.goalKg)) + row('To go', cur > p.goalKg ? wStr(cur - p.goalKg) : 'Done', '') +
      (tr ? row('Pace', (tr.perWeek < 0 ? '−' : '+') + wStr(Math.abs(tr.perWeek)) + '/wk', '') : '') + (tr && tr.etaDays ? row('Goal date', shortDate(Store.addDays(t, tr.etaDays)).replace(/^\w+ /, ''), '') : '') +
      row('Record W–L–D', rec.w + '–' + rec.l + '–' + rec.d, '') + row('Unbeaten run', Store.streak() + (Store.streak() === 1 ? ' day' : ' days'), '') +
      '<div class="goal-bar" role="img" aria-label="' + Math.round(pct * 100) + ' percent of the way to your goal weight"><i style="width:' + Math.round(pct * 100) + '%"></i></div><p style="margin-top:8px"><a class="link" href="#/">Log weight</a></p>';
  }
  function weekHTML(t) {
    var ws = weekStart(t), cells = '', i, n = 0, tiles = [];
    for (i = 0; i < 7; i++) {
      var ds = Store.addDays(ws, i), inf = Store.dayInfo(ds), pm = inf.planned;
      if (!inf.plannedAll.length && !inf.trained.length) { continue; }   // rest days are left out of the strip
      n++;
      var label = inf.kind === 'done' ? 'Done' : inf.kind === 'missed' ? 'No show' : inf.kind === 'madeup' ? 'Made up' : inf.kind === 'today' ? 'Today' : inf.kind === 'upcoming' ? 'Planned' : '';
      var ms = inf.trained.length ? inf.trained : inf.plannedAll;
      tiles.push({ ds: ds, i: i, kind: inf.kind, ms: ms, label: label });
    }
    var short = tiles.length >= 6 || tiles.some(function (x) { return x.ms.length > 1; });   // many tiles or several muscles a day: three-letter names, one per line
    tiles.forEach(function (x) {
      cells += '<a class="wd ' + x.kind + (short ? ' short' : '') + '" href="' + (x.kind === 'today' ? '#/today' : '#/calendar/' + x.ds) + '" aria-label="' + DAYS[(x.i + 1) % 7] + ': ' + mList(x.ms) + (x.label ? ', ' + x.label : '') + '"><span class="dn">' + DAYS[(x.i + 1) % 7].slice(0, 3) + '</span><span class="mn">' + x.ms.map(function (m) { return '<span>' + (short ? mShort(m) : mName(m)) + '</span>'; }).join('') + '</span><span class="st">' + ((short ? ({ Done: 'Done', 'No show': 'Miss', 'Made up': 'Made', Today: 'Now', Planned: '' })[x.label] : x.label) || '&nbsp;') + '</span></a>';
    });
    return '<div class="week" style="grid-template-columns:repeat(' + Math.max(n, 1) + ',minmax(0,1fr))" aria-label="This week">' + (cells || '<p class="muted">No training days in your plan. Set your week in the Plan tab.</p>') + '</div>';
  }

  /* ---------- the home screen: tonight's card ---------- */
  function viewToday() {
    var t = Store.today(), info = Store.dayInfo(t), plans = info.plannedAll, plan = plans[0] || null, all = Store.allLogs(), cur = Store.currentKg();
    var main = '', under = '', ticker = '<b>' + longDate(t) + '</b>', howto = '<details class="howto"><summary>How a session works</summary><ol><li>Warm up with 1 or 2 light rounds of your first exercise.</li><li>Log each round right after you finish it: reps, then kg.</li><li>Rest 60 to 90 seconds. Pick a weight where your last rep looks like your first.</li><li>Open Form guide on any exercise to rotate the 3D figure and check your position.</li><li>Tap Finish workout to see how you did against last time.</li></ol></details>';
    if (info.kind === 'done') {
      var logs = Store.logsOn(t), names = info.trained.map(mName).join(' and '), rowsN = 0;
      ticker += '<span>' + esc(names) + ' day</span><span>' + (leftToday(info).length ? 'Halftime' : 'Fight over') + '</span>';
      var left = leftToday(info);
      main = '<div class="main-event noimg"><div class="me-l"><span class="badge red">' + (left.length ? 'Halftime' : 'Fight over') + '</span><h1>' + esc(names) + ' done</h1><p class="vs">' + logs.length + (logs.length === 1 ? ' round' : ' rounds') + ' · ' + Math.round(Store.volume(logs)).toLocaleString() + ' ' + U() + ' lifted · about ' + Stats.calories(logs, cur) + ' kcal (estimate)</p>' +
        '<p class="done-note">' + (left.length ? mList(left) + ' still to go today.' : 'Nice work.') + '</p><div class="today-actions">' + left.map(function (m) { return '<a class="btn primary" href="#/m/' + m + '">Start ' + mName(m).toLowerCase() + ' →</a>'; }).join('') + '<a class="' + (left.length ? 'link' : 'btn primary') + '" href="#/m/' + info.trained[0] + '">Add more rounds</a><a class="link" href="#/summary/' + info.trained[0] + '">See today\'s summary</a><a class="link" href="#/pick">Train another muscle</a></div></div></div>';
      info.trained.forEach(function (m) { var seen = {}; logs.filter(function (l) { return l.m === m; }).forEach(function (l) { if (!seen[l.e] && Data.byId[l.e]) { seen[l.e] = 1; under += '<li>' + doneRow(Data.byId[l.e], rowsN++, t, m) + '</li>'; } }); });
    } else if (plan) {
      var exs = [], owner = {}, sets = 0; plans.forEach(function (m) { visibleEx(m).forEach(function (e) { exs.push(e); owner[e.id] = m; }); }); exs.forEach(function (e) { sets += e.sets; });
      var pname = plans.map(mName).join(' + ');
      ticker += '<span>' + pname + ' day</span><span>' + exs.length + (exs.length === 1 ? ' bout' : ' bouts') + '</span><span>About ' + (Math.round(sets * 2.5 / 5) * 5) + ' min</span><span>Rest 60–90 s between rounds</span>';
      if (exs.length) {
        var ex0 = exs[0], last0 = Store.lastSession(ex0.id, t);
        main = '<div class="main-event"><div class="me-l"><span class="badge">Main event</span><h1>' + esc(ex0.name) + '</h1><p class="vs"><b>You</b><em>vs</em>' + (last0 ? 'You, ' + shortDate(last0.date).replace(/^\w+ /, '') : 'a first fight') + '</p>' +
          '<div class="facts"><div>Rounds<b>' + ex0.sets + '</b></div><div>Reps<b>' + esc(ex0.reps) + '</b></div><div>Their best<b>' + (last0 ? setText(bestSet(last0.sets)) : '—') + '</b></div></div>' +
          '<div class="today-actions"><a class="btn primary" href="#/m/' + owner[ex0.id] + '">Enter the ring →</a></div></div><div class="me-r">' + (ex0.custom ? '' : '<img src="img/ex/' + ex0.id + '.webp" alt="">') + '</div></div>';
        exs.slice(1).forEach(function (e, i) { under += '<li>' + boutRow(e, i + 1, t, owner[e.id]) + '</li>'; });
      } else { main = '<div class="main-event noimg"><div class="me-l"><span class="badge red">Empty card</span><h1>' + esc(pname) + '</h1><p class="vs">All exercises for this muscle are switched off. Turn some on in the Plan tab.</p></div></div>'; }
    } else {
      var nx = nextCard(t);
      ticker += '<span>Rest day</span>';
      if (nx) { var nxs = []; Data.planAll(Store.parse(nx.date).getDay()).forEach(function (m) { visibleEx(m).forEach(function (e) { nxs.push([e, m]); }); }); nxs.slice(0, 6).forEach(function (q, i) { under += '<li>' + boutRow(q[0], i, t, q[1]) + '</li>'; }); if (nxs.length) { under = '<li class="under-h"><span class="lab"><span>Next card: ' + DAYS[Store.parse(nx.date).getDay()] + ', ' + Data.planAll(Store.parse(nx.date).getDay()).map(mName).join(' + ') + '</span><span>' + nxs.length + ' bouts</span></span></li>' + under; } }
      main = '<div class="main-event rest"><div class="me-l"><span class="badge">Rest day</span><h1>Rest day</h1><p class="vs">Recovery is part of the plan' + (nx ? '. Next card: ' + DAYS[Store.parse(nx.date).getDay()] + ', ' + mName(nx.muscle) : '') + '</p>' +
        '<div class="today-actions"><a class="btn primary" href="#/pick">Train anyway</a></div></div></div>';
    }
    var h = '<div class="ticker">' + ticker + '</div><div class="today-grid"><section class="t-main" aria-label="Today\'s card"><div class="lab"><span>The card</span><span>Main event first, undercard below</span></div>' + main +
      (under ? '<ul class="bouts">' + under + '</ul>' : '') +
      '<div class="t-actions">' + (info.kind === 'done' ? '' : '<a class="link" href="#/pick">Choose a different muscle</a>') + plans.map(function (m) { return '<a class="link" href="#/plan/' + m + '">Edit ' + mName(m).toLowerCase() + ' exercises</a>'; }).join('') + howto + '</div></section>' +
      '<aside class="side"><section class="tape">' + tapeHTML(t) + '</section><section class="d-card fweek"><div class="lab"><span>Fight week</span><span></span></div>' + weekHTML(t) + '</section>' + catchUp(t) + deloadHTML(t) + quoteHTML() + '</aside></div>';
    h += '<p class="sync-line" id="sync-line">' + esc(syncText()) + '</p>';
    if (!Store.persistent) { h += '<p class="warn">This browser is not saving data (private mode or storage blocked). Export a backup from the Plan tab before you close it.</p>'; }
    return h;
  }

  /* ---------- the dashboard: overall numbers ---------- */
  function dashParts(t) {
    var all = Store.allLogs(), ws = weekStart(t), we = Store.addDays(ws, 6), cur = Store.currentKg();
    var mo = t.slice(0, 7), days = {}, weekLogs = all.filter(function (l) { return l.d >= ws && l.d <= we; }), prs = 0, vol = Math.round(Store.volume(weekLogs));
    all.forEach(function (l) { if (l.d.slice(0, 7) === mo) { days[l.d] = 1; } });
    weekLogs.forEach(function (l) { if (Stats.prFor(l, exLogs(l.e))) { prs++; } });
    var stats = '<div class="lab"><span>Overview</span><span>This week</span></div><div class="stats six"><a class="st-link" href="#/calendar"><b class="num">' + Store.streak() + '</b><span>Day streak</span></a><a class="st-link" href="#/calendar"><b class="num">' + Object.keys(days).length + '</b><span>Sessions this month</span></a>' +
      '<a class="st-link" href="#/home/balance"><b class="num">' + weekLogs.length + '</b><span>Sets this week</span></a><div><b class="num">' + vol.toLocaleString() + '</b><span>Kg lifted this week</span></div>' +
      '<a class="st-link" href="#/home/records"><b class="num">' + prs + '</b><span>New PRs this week</span></a><div><b class="num">' + Stats.calories(weekLogs, cur).toLocaleString() + '</b><span>Kcal this week (estimate)</span></div></div>' +
      '<p class="small-note">Calories are a rough estimate from your body weight, sets, reps and kilograms, usually within about 30 percent.</p><button class="btn small" type="button" data-act="share-week" style="margin-top:12px">Share this week</button>';
    var lastD = '', lastLogs;
    all.forEach(function (l) { if (l.d <= t && l.d > lastD) { lastD = l.d; } });
    var last = '<div class="lab"><span>Last session</span><span></span></div>';
    if (!lastD) { last += '<p class="empty">Log your first round and your last session shows up here with how it compared to the time before.</p>'; }
    else {
      lastLogs = Store.logsOn(lastD); var ids = [], up = 0, down = 0, cmp = 0, ms = [];
      lastLogs.forEach(function (l) { if (ids.indexOf(l.e) < 0) { ids.push(l.e); } if (ms.indexOf(l.m) < 0) { ms.push(l.m); } });
      ids.forEach(function (id) { var ss = Stats.sessions(id, all), c = ss.filter(function (x) { return x.date === lastD; })[0], pv = ss.filter(function (x) { return x.date < lastD; }).pop(); if (c && pv) { cmp++; var v = Stats.compare(c, pv).verdict; if (v === 'up') { up++; } else if (v === 'down') { down++; } } });
      last += '<h3><a class="plain" href="#/calendar/' + lastD + '">' + esc(ms.map(mName).join(' and ')) + '</a></h3><p class="muted">' + (lastD === t ? 'Today' : longDate(lastD)) + '</p><p style="margin-top:8px">' + lastLogs.length + ' sets, ' + Math.round(Store.volume(lastLogs)).toLocaleString() + ' ' + U() + ' lifted, about ' + Stats.calories(lastLogs, cur) + ' kcal' +
        (cmp ? '. Won ' + up + ' of ' + cmp + ' bouts against the time before' + (down ? ', lost ' + down : '') : '') + '.</p>';
    }
    return { stats: stats, tape: tapeHTML(t), week: '<div class="lab"><span>Fight week</span><span></span></div>' + weekHTML(t), last: last, bal: '<div class="lab"><span>Sets per muscle</span><span>This week vs 4-week average</span></div>' + balanceHTML(t) };
  }

  // suggest an easier week when several lifts dropped in their latest session this week
  function deloadHTML(t) {
    var all = Store.allLogs(), from = Store.addDays(t, -7), ids = [], down = 0, up = 0;
    all.forEach(function (l) { if (l.d >= from && ids.indexOf(l.e) < 0) { ids.push(l.e); } });
    ids.forEach(function (id) { var ss = Stats.sessions(id, all), c = ss[ss.length - 1], pv = ss[ss.length - 2]; if (c && pv && c.date >= from) { var v = Stats.compare(c, pv).verdict; if (v === 'down') { down++; } else if (v === 'up') { up++; } } });
    return down >= 2 && down > up ? '<div class="note gold"><b class="t">Consider an easier week</b>' + down + ' of your lifts came in lower than last time. If you are also tired or sleeping badly, take 10 to 15 percent off the weights for a week, then build back up. If you feel fine, ignore this.</div>' : '';
  }

  // sets per muscle: this week against the average of the 4 weeks before
  function balanceHTML(t) {
    var grp = {}; Data.EX.forEach(function (e) { grp[e.id] = e.muscle; });
    var ws0 = weekStart(t), cnt = Stats.setsByGroup(Store.allLogs(), grp, ws0, Store.addDays(ws0, 6)), prev = Stats.setsByGroup(Store.allLogs(), grp, Store.addDays(ws0, -28), Store.addDays(ws0, -1));
    return '<ul class="bal">' + Data.ORDER.map(function (g) { var a = cnt[g] || 0, b = Math.round((prev[g] || 0) / 4); return '<li><span>' + Data.MUSCLES[g].name + '</span><div class="bal-bar" role="img" aria-label="' + a + ' sets this week, ' + b + ' average"><i style="width:' + Math.min(100, a * 100 / 15) + '%"></i></div><b>' + a + '</b><small>avg ' + b + '</small></li>'; }).join('') + '</ul>';
  }

  /* ---------- body measurements ---------- */
  function measuresSection() {
    var ms = Store.measures(), t = Store.today(), last = ms[ms.length - 1];
    var h = '<div class="sec" id="sec-measures"><h2>Body measurements</h2><p class="sub">In centimetres. Your waist often shows fat loss when the scale stalls. Measure at the same spot each time.</p>';
    if (ms.length >= 2) {
      h += Charts.line(ms.filter(function (m) { return m.waist; }).map(function (m) { return { x: Store.parse(m.d).getTime() / 864e5, y: m.waist, label: shortDate(m.d) + ': waist ' + kgStr(m.waist) + ' cm' }; }), { unit: ' cm', aria: 'Waist measurement over time', xLabel: chartX });
    }
    if (last) { var first = ms[0]; h += '<p class="muted">Latest ' + shortDate(last.d) + ': ' + ['waist', 'chest', 'arm'].filter(function (k) { return last[k]; }).map(function (k) { var dlt = first !== last && first[k] ? ' (' + (last[k] - first[k] > 0 ? '+' : '') + kgStr(Math.round((last[k] - first[k]) * 10) / 10) + ' since ' + shortDate(first.d) + ')' : ''; return k + ' ' + kgStr(last[k]) + ' cm' + dlt; }).join(', ') + '.</p>'; }
    h += '<form class="row-form" data-form="measure"><div class="fld"><label for="ms-d">Date</label><input id="ms-d" class="text-in" type="date" value="' + t + '" max="' + t + '"></div>' +
      ['waist', 'chest', 'arm'].map(function (k) { return '<div class="fld"><label for="ms-' + k + '">' + k.charAt(0).toUpperCase() + k.slice(1) + '</label><input id="ms-' + k + '" class="text-in num" type="number" inputmode="decimal" step="0.1" min="10" max="250" value="' + (last && last[k] ? kgStr(last[k]) : '') + '"></div>'; }).join('') +
      '<button class="btn primary" type="submit">Save</button></form></div>';
    return h;
  }

  /* ---------- friends (read only) ---------- */
  /* ---------- friends (read only): cards on Home that open a profile dialog ---------- */
  var FRIEND_FRESH = 6 * 3600 * 1000, fLoading = {};
  function friendList() { try { return JSON.parse(localStorage.getItem('gymtracker.friends')) || []; } catch (e) { return []; } }
  function saveFriends(l) { try { localStorage.setItem('gymtracker.friends', JSON.stringify(l)); } catch (e) {} }
  function fcache() { try { return JSON.parse(localStorage.getItem('gymtracker.fcache')) || {}; } catch (e) { return {}; } }
  function fcacheSave(c) { try { localStorage.setItem('gymtracker.fcache', JSON.stringify(c)); } catch (e) {} }
  // fetch (or reuse, if fresh) a friend's last 30 days; keeps only what the profile needs
  function friendLoad(name, force) {
    var c = fcache()[name]; if (c && !force && Date.now() - c.at < FRIEND_FRESH) { return Promise.resolve(c); }
    if (fLoading[name]) { return fLoading[name]; }
    fLoading[name] = Sync.peek(name).then(function (l) {
      var all = fcache(); all[name] = { at: Date.now(), logs: l.slice(0, 400).map(function (x) { return [x.d, x.m, x.e, x.reps, x.kg]; }) }; fcacheSave(all); delete fLoading[name]; return all[name];
    }, function (e) { delete fLoading[name]; throw e; });
    return fLoading[name];
  }
  function friendStats(rec) {
    var t = Store.today(), ws = weekStart(t), we = Store.addDays(ws, 6), d14 = Store.addDays(t, -13), byDay = {}, best = {}, sets7 = 0, vol7 = 0, d7 = Store.addDays(t, -6);
    rec.logs.forEach(function (r) {
      var d = r[0], o = byDay[d] || (byDay[d] = { d: d, m: [], sets: 0, vol: 0 }); if (o.m.indexOf(r[1]) < 0) { o.m.push(r[1]); } o.sets++; o.vol += r[3] * r[4];
      if (d >= d7) { sets7++; vol7 += r[3] * r[4]; }
      var e = Stats.epley(r[4], r[3]); if (r[4] > 0 && (!best[r[2]] || e > best[r[2]].e)) { best[r[2]] = { e: e, kg: r[4], reps: r[3], id: r[2] }; }
    });
    var days = Object.keys(byDay).sort(), week = [], i, wk = 0, wsets = 0, wvol = 0;
    for (i = 0; i < 7; i++) { var ds = Store.addDays(ws, i), o = byDay[ds]; week.push({ d: ds, m: o ? o.m : [] }); if (o) { wk++; wsets += o.sets; wvol += o.vol; } }
    var lastD = days[days.length - 1];
    return { days14: days.filter(function (d) { return d >= d14; }).length, sets7: sets7, vol7: vol7, week: week, wk: wk, wsets: wsets, wvol: wvol, last: lastD ? byDay[lastD] : null,
      recent: days.slice(-5).reverse().map(function (d) { return byDay[d]; }),
      best: Object.keys(best).map(function (k) { return best[k]; }).sort(function (a, b) { return b.e - a.e; }).slice(0, 3), any: days.length > 0 };
  }
  function avatar(name, big) {
    var h = 0, i; for (i = 0; i < name.length; i++) { h = (h * 31 + name.charCodeAt(i)) % 3; }
    return '<span class="av av' + h + (big ? ' big' : '') + '" aria-hidden="true">' + esc(name.charAt(0).toUpperCase()) + '</span>';
  }
  function ago(ts) { var m = Math.round((Date.now() - ts) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' d ago'; }
  function dayName(ds) { return DAYS[Store.parse(ds).getDay()]; }
  function weekDots(week) { return '<span class="fdots" aria-hidden="true">' + week.map(function (x) { return '<i class="' + (x.m.length ? 'on' : '') + '"></i>'; }).join('') + '</span>'; }
  function friendCard(name) {
    var rec = fcache()[name], body;
    if (fLoading[name] && !rec) { body = '<span class="fsub">Loading…</span>'; }
    else if (!rec) { body = '<span class="fsub">Tap to load their workouts</span>'; }
    else { var st = friendStats(rec); body = st.any ? '<span class="fsub">' + (st.last ? 'Last: ' + dayName(st.last.d).slice(0, 3) + ' · ' + mList(st.last.m) : '') + '</span><span class="fsub">' + st.wk + (st.wk === 1 ? ' session' : ' sessions') + ' this week</span>' : '<span class="fsub">No workouts in the last 30 days</span>'; }
    return '<li><button type="button" class="fcard" data-act="friend-open" data-n="' + esc(name) + '">' + avatar(name) + '<span class="fmain"><b>' + esc(name) + '</b>' + body + '</span>' + (rec ? weekDots(friendStats(rec).week) : '') + '</button></li>';
  }
  function friendsSection() {
    var l = friendList();
    return '<div class="sec" id="sec-friends"><h2>Friends</h2><p class="sub">Add a friend\'s username to see how their week is going. Anyone who knows a username can look at it, so only add people you trust.</p>' +
      (l.length ? '<ul class="friends">' + l.map(friendCard).join('') + '</ul>' : '<p class="empty">No friends yet. Add a username below, and their latest workouts show up here.</p>') +
      '<form class="row-form" data-form="friend"><div class="fld"><label for="fr-n">Friend\'s username</label><input id="fr-n" class="text-in" maxlength="20" autocapitalize="none" autocomplete="off"></div><button class="btn small" type="submit">Add friend</button></form></div>';
  }
  // refresh stale friends in the background, then redraw only the Friends section (called after Home renders)
  function friendsRefresh() {
    friendList().forEach(function (n) {
      var c = fcache()[n]; if (c && Date.now() - c.at < FRIEND_FRESH) { return; }
      friendLoad(n).then(function () { var el = document.getElementById('sec-friends'); if (el && route().name === 'home') { el.outerHTML = friendsSection(); } }, function () {});
    });
  }
  function friendSheet(name) {
    var rec = fcache()[name]; if (!rec) { return openSheet('<h2>' + esc(name) + '</h2><p class="muted" id="fs-load">Loading…</p>', 'sheet-friend'); }
    var st = friendStats(rec), mine = weekMine();
    var dots = st.week.map(function (x, i) { return '<div class="fd' + (x.m.length ? ' on' : '') + '"><b>' + DAYS[(i + 1) % 7].slice(0, 1) + '</b><span>' + (x.m.length ? x.m.map(mShort).join('<br>') : '·') + '</span></div>'; }).join('');
    var vs = function (label, a, b) { var top = Math.max(a, b, 1); return '<div class="vs-row"><span>' + label + '</span><div class="vs-bars"><i class="me" style="width:' + Math.round(a / top * 100) + '%"></i><i class="fr" style="width:' + Math.round(b / top * 100) + '%"></i></div><b class="num">' + a + ' · ' + b + '</b></div>'; };
    var lead = mine.sets === st.wsets ? 'You are level this week.' : mine.sets > st.wsets ? 'You are ahead by ' + (mine.sets - st.wsets) + (mine.sets - st.wsets === 1 ? ' set' : ' sets') + ' this week.' : esc(name) + ' is ahead by ' + (st.wsets - mine.sets) + (st.wsets - mine.sets === 1 ? ' set' : ' sets') + ' this week.';
    var body = '<div class="fhead">' + avatar(name, true) + '<div><h2>' + esc(name) + '</h2><p class="sub">Updated ' + ago(rec.at) + '. <button class="link" type="button" data-act="friend-refresh" data-n="' + esc(name) + '">Refresh</button></p></div></div>';
    if (!st.any) { return openSheet(body + '<p class="empty">No workouts in the last 30 days. When they log something, it shows up here.</p><div class="btns"><button class="link danger" type="button" data-act="friend-del" data-n="' + esc(name) + '">Remove friend</button></div>', 'sheet-friend'); }
    body += '<div class="stats four fstats"><div><b class="num">' + st.wk + '</b><span>Sessions this week</span></div><div><b class="num">' + st.sets7 + '</b><span>Sets, 7 days</span></div><div><b class="num">' + Math.round(Stats.toU(st.vol7)).toLocaleString() + '</b><span>' + U() + ' lifted, 7 days</span></div><div><b class="num">' + st.days14 + '</b><span>Days trained, 14 days</span></div></div>' +
      '<p class="lab" style="margin-top:18px"><span>This week</span></p><div class="fweekrow">' + dots + '</div>' +
      '<p class="lab" style="margin-top:18px"><span>You vs ' + esc(name) + '</span><span>This week</span></p><div class="vs">' + vs('Sessions', mine.sessions, st.wk) + vs('Sets', mine.sets, st.wsets) + '</div><p class="sub" style="margin-top:6px">' + lead + '</p>' +
      (st.best.length ? '<p class="lab" style="margin-top:18px"><span>Best lifts, last 30 days</span></p><ul class="hist-list">' + st.best.map(function (b) { var ex = Data.byId[b.id]; return '<li><span class="hd">' + esc(ex ? ex.name : 'Custom exercise') + '</span><span class="hs num">' + wStr(b.kg) + ' ' + U() + ' × ' + b.reps + '</span></li>'; }).join('') + '</ul>' : '') +
      '<p class="lab" style="margin-top:18px"><span>Recent workouts</span></p><ul class="hist-list">' + st.recent.map(function (o) { return '<li><span class="hd">' + dayName(o.d).slice(0, 3) + ' ' + Store.parse(o.d).getDate() + ' · ' + mList(o.m) + '</span><span class="hs num">' + o.sets + ' sets, ' + Math.round(Stats.toU(o.vol)).toLocaleString() + ' ' + U() + '</span></li>'; }).join('') + '</ul>' +
      '<div class="btns"><button class="link danger" type="button" data-act="friend-del" data-n="' + esc(name) + '">Remove friend</button></div>';
    return openSheet(body, 'sheet-friend');
  }
  function weekMine() {
    var t = Store.today(), ws = weekStart(t), we = Store.addDays(ws, 6), logs = Store.allLogs().filter(function (l) { return l.d >= ws && l.d <= we; }), days = {};
    logs.forEach(function (l) { days[l.d] = 1; }); return { sessions: Object.keys(days).length, sets: logs.length };
  }

  /* ---------- weekly summary text ---------- */
  function weekSummaryText() {
    var t = Store.today(), ws = weekStart(t), we = Store.addDays(ws, 6), logs = Store.allLogs().filter(function (l) { return l.d >= ws && l.d <= we; }), days = {}, prs = 0, ms = [];
    logs.forEach(function (l) { days[l.d] = 1; if (ms.indexOf(l.m) < 0) { ms.push(l.m); } if (Stats.prFor(l, exLogs(l.e))) { prs++; } });
    return 'Gym week from ' + shortDate(ws) + ': ' + Object.keys(days).length + ' sessions' + (ms.length ? ' (' + ms.map(mName).join(', ') + ')' : '') + ', ' + logs.length + ' sets, ' + Math.round(Store.volume(logs)).toLocaleString() + ' ' + U() + ' lifted' + (prs ? ', ' + prs + ' new PRs' : '') +
      ', about ' + Stats.calories(logs, Store.currentKg()) + ' kcal. Streak ' + Store.streak() + ' days. Weight ' + wStr(Store.currentKg()) + ' ' + U() + ', goal ' + wStr(Store.profile().goalKg) + ' ' + U() + '.';
  }

  /* ---------- exercise library (public-domain free-exercise-db), loaded on first search ---------- */
  var lib = null, libHits = [], libTimer;
  var LIB_MUSCLE = { chest: 'chest', lats: 'back', 'middle back': 'back', 'lower back': 'back', traps: 'back', quadriceps: 'legs', hamstrings: 'legs', glutes: 'legs', calves: 'legs', adductors: 'legs', abductors: 'legs', shoulders: 'shoulders', biceps: 'arms', triceps: 'arms', forearms: 'arms' };
  var LIB_EQUIP = { barbell: 'Barbell', dumbbell: 'Dumbbells', 'e-z curl bar': 'Barbell', machine: 'Machine', cable: 'Machine', 'body only': 'Bodyweight' };
  function libSearch(q) {
    var box = document.getElementById('cx-res'); if (!box) { return; }
    q = q.trim().toLowerCase(); if (q.length < 3) { box.innerHTML = ''; return; }
    var go = function () {
      libHits = lib.filter(function (e) { return e.name.toLowerCase().indexOf(q) >= 0; }).slice(0, 6);
      box.innerHTML = libHits.length ? libHits.map(function (e, i) { return '<button type="button" class="chip" data-act="lib-pick" data-i="' + i + '">' + esc(e.name) + '</button>'; }).join('') : '<p class="muted">No match. You can still type the name below.</p>';
    };
    if (lib) { go(); return; }
    box.innerHTML = '<p class="muted">Loading the library…</p>';
    fetch('https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json').then(function (r) { return r.json(); }).then(function (j) { lib = j; go(); })
      .catch(function () { box.innerHTML = '<p class="muted">The library needs an internet connection. You can still type the name below.</p>'; });
  }


  // missed muscles from the last 6 days that are not made up yet, with a link to train them now
  // 'Mon', 'Mon and Thu', 'not scheduled'
  function daysText(muscle) { var d = Data.daysOf(muscle).map(function (n) { return DAYS[n].slice(0, 3); }); return d.length ? d.join(' and ') : 'Not in your week'; }
  function catchUp(t) {
    var out = [], i;
    for (i = 1; i <= 6; i++) { var inf = Store.dayInfo(Store.addDays(t, -i)); if (inf.kind === 'missed') { inf.plannedAll.forEach(function (m) { if (out.indexOf(m) < 0) { out.push(m); } }); } }
    return out.length ? '<div class="note catch"><b class="t">' + out.length + (out.length === 1 ? ' no show' : ' no shows') + ' this week</b>' + out.map(mName).join(', ') + ' still owed. ' + out.map(function (m) { return '<a href="#/m/' + m + '">Train ' + mName(m).toLowerCase() + ' now</a>'; }).join('') + '</div>' : '';
  }

  /* =========================================================  YOUR WEEK (schedule + equipment)  */
  var WEEK = [1, 2, 3, 4, 5, 6, 0], onboardWeek = false;
  function sameSchedule(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  function sessionMinutes(muscles) { var sets = 0; muscles.forEach(function (m) { visibleEx(m).forEach(function (e) { sets += e.sets; }); }); return Math.round(sets * 2.5 / 5) * 5; }
  function scheduleHTML() {
    var sc = Store.schedule(), days = 0, mins = 0, seen = {};
    var presets = Data.PRESETS.map(function (pr) { return '<button type="button" class="preset" data-act="sched-preset" data-id="' + pr.id + '" aria-pressed="' + sameSchedule(sc, pr.map) + '"><b>' + esc(pr.name) + '</b><small>' + esc(pr.note) + '</small></button>'; }).join('');
    var rows = WEEK.map(function (d) {
      var sel = sc[d] || [], m = sel.length ? sessionMinutes(sel) : 0; if (sel.length) { days++; mins += m; sel.forEach(function (x) { seen[x] = 1; }); }
      return '<div class="sched-day' + (sel.length ? ' on' : '') + '"><div class="sd-h"><b>' + DAYS[d] + '</b><small>' + (sel.length ? 'About ' + m + ' min' : 'Rest day') + '</small></div><div class="sd-chips" role="group" aria-label="' + DAYS[d] + ' muscles">' +
        Data.ORDER.map(function (g) { return '<button type="button" class="chip" data-act="sched-chip" data-d="' + d + '" data-m="' + g + '" aria-pressed="' + (sel.indexOf(g) >= 0) + '">' + Data.MUSCLES[g].name + '</button>'; }).join('') + '</div></div>';
    }).join('');
    var miss = Data.ORDER.filter(function (g) { return !seen[g] && !Data.MUSCLES[g].optional; }).map(mName);
    return '<div id="sched"><p class="lab" style="margin-top:6px"><span>Start from a template</span></p><div class="presets">' + presets + '</div>' +
      '<p class="lab" style="margin-top:18px"><span>Or set each day</span><span>Up to 3 muscles a day</span></p><div class="sched">' + rows + '</div>' +
      '<p class="sched-sum" role="status"><b>' + days + ' training ' + (days === 1 ? 'day' : 'days') + ', ' + (7 - days) + ' rest</b>' + (days ? ' · about ' + mins + ' min a week' : '') + '</p>' +
      (days === 0 ? '<p class="note"><b class="t">No training days</b>Pick at least one muscle on a day, or choose a template.</p>' : '') +
      (miss.length && days ? '<p class="muted small-note">Not in your week: ' + miss.join(', ') + '. That is fine if you skip them on purpose. You can still train them any time from Choose a different muscle.</p>' : '') + '</div>';
  }
  function equipHTML() {
    var kinds = [['Barbell', 'Barbell'], ['Dumbbells', 'Dumbbells'], ['Machine', 'Machines'], ['Bodyweight', 'Bodyweight']];
    return '<div class="chips-row" role="group" aria-label="Equipment you have">' + kinds.map(function (k) {
      var list = Data.EX.filter(function (e) { return !e.custom && e.equip === k[0]; }), on = list.some(function (e) { return !Store.isHidden(e.id); });
      return '<button type="button" class="chip" data-act="equip" data-k="' + k[0] + '" aria-pressed="' + on + '">' + k[1] + '</button>'; }).join('') + '</div>';
  }
  function weekSummary() { var sc = Store.schedule(), n = Object.keys(sc).length; return n + ' training ' + (n === 1 ? 'day' : 'days') + ' a week'; }
  var weekOpen = false;
  function sessionRange() { var sc = Store.schedule(), m = WEEK.filter(function (d) { return sc[d]; }).map(function (d) { return sessionMinutes(sc[d]); }); return m.length ? 'About ' + Math.min.apply(null, m) + (Math.max.apply(null, m) > Math.min.apply(null, m) ? ' to ' + Math.max.apply(null, m) : '') + ' minutes a session.' : ''; }
  function routineSummaryHTML() {
    var sc = Store.schedule();
    return '<ul class="routine">' + WEEK.filter(function (d) { return sc[d]; }).map(function (d) { return '<li><b>' + DAYS[d].slice(0, 3) + '</b><span>' + sc[d].map(mName).join(' + ') + '</span></li>'; }).join('') + '</ul>';
  }
  function viewWeek() {
    if (!weekOpen) {
      return '<h1>Your week</h1><p class="intro">Here is a normal routine to start with: five training days, one muscle a day, weekends off. Happy with it? Start training. You can change it at any time in the Plan tab.</p>' +
        '<section class="sec"><h2>Normal routine</h2>' + routineSummaryHTML() + '<p class="muted small-note">' + sessionRange() + '</p></section>' +
        '<button class="btn primary block" type="button" data-act="week-done" style="margin-top:16px">Start training</button>' +
        '<button class="btn block" type="button" data-act="week-open" style="margin-top:10px">Customise my week (optional)</button>';
    }
    return '<h1>Customise your week</h1><p class="intro">Choose the days you train and what you train on each. A rest day on Sunday, two sessions a week, or every day: it is up to you.</p>' +
      '<section class="sec"><h2>Your schedule</h2>' + scheduleHTML() + '</section><section class="sec"><h2>Your equipment</h2><p class="sub">Switch off anything your gym does not have. Those exercises stay out of your workouts.</p>' + equipHTML() + '</section>' +
      '<button class="btn primary block" type="button" data-act="week-done" style="margin-top:16px">Start training</button>' +
      '<button class="btn block" type="button" data-act="week-reset" style="margin-top:10px">Back to the normal routine</button>';
  }

  /* =========================================================  PICK  */
  function viewPick() {
    var t = Store.today();
    var h = '<a class="crumb" href="#/today">Back to today</a><h1>Which muscle today?</h1><div class="pick-wrap"><div><ul class="pick-list">';
    Data.ORDER.forEach(function (id) {
      var m = Data.MUSCLES[id];
      h += '<li><a href="#/m/' + id + '"><span><span class="nm">' + m.name + '</span><br><span class="sub">' + daysText(id) + ', ' + visibleEx(id).length + ' exercises</span></span>' +
        (Data.planAll(Store.parse(t).getDay()).indexOf(id) >= 0 ? '<span class="tag">Planned today</span>' : '') + '</a><a class="pick-edit" href="#/plan/' + id + '">Edit ' + Data.exercisesFor(id).length + ' exercises</a></li>';
    });
    return h + '</ul></div><aside class="stage" aria-hidden="true"><canvas id="stage-cv"></canvas><p class="stage-cap" id="stage-cap">Point at a muscle</p></aside></div>';
  }
  // laptop only: a live body that turns and zooms to the muscle you point at
  var stageObj = null, stageOn = '';
  function stageDefault() { var p = Data.planAll(Store.parse(Store.today()).getDay()); return p[0] || 'all'; }
  function stageFocus(g) { if (!stageObj) { return; } stageObj.focus(g); var c = document.getElementById('stage-cap'); if (c) { c.textContent = Data.MUSCLES[g] ? Data.MUSCLES[g].name : 'Point at a muscle'; } }
  function setupStage(r) {
    stageObj = null; var cv = document.getElementById('stage-cv');
    if (r.name !== 'pick' || !cv || !window.matchMedia('(min-width: 1000px)').matches || saveData()) { return; }
    var cap = document.getElementById('stage-cap'); cap.textContent = 'Loading the body…';
    load3D().then(function () { return Engine3D.stage(cv); }).then(function (st) {
      if (!st || document.getElementById('stage-cv') !== cv) { if (st) { st.stop(); } return; }
      stageObj = st; stageFocus(stageDefault());
    }).catch(function () { var a = document.querySelector('.stage'); if (a) { a.hidden = true; } });
  }
  document.addEventListener('mouseover', function (e) { var a = e.target.closest && e.target.closest('.pick-list a[href^="#/m/"]'); if (a) { stageFocus(a.getAttribute('href').split('/')[2]); } });
  document.addEventListener('focusin', function (e) { var a = e.target.closest && e.target.closest('.pick-list a[href^="#/m/"]'); if (a) { stageFocus(a.getAttribute('href').split('/')[2]); } });
  document.addEventListener('mouseout', function (e) { if (e.target.closest && e.target.closest('.pick-list') && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('.pick-list'))) { stageFocus(stageDefault()); } });

  /* =========================================================  WORKOUT  */
  function initialDraft(ex, today) {
    var done = Store.workSets(today, ex.id), last = Store.lastSession(ex.id, today);
    if (done.length) { var s = done[done.length - 1]; return { reps: s.reps, kg: s.kg }; }
    if (last && last.sets.length) { var ls = last.sets[Math.min(done.length, last.sets.length - 1)]; return { reps: ls.reps, kg: ls.kg }; }
    return { reps: parseInt(ex.reps, 10) || 10, kg: 0 };
  }

  var barKg = (function () { try { return +localStorage.getItem('gymtracker.bar') || 20; } catch (e) { return 20; } })();   // 20 or 15 (the lighter bar); shown as 45 or 35 lb in pounds
  function platesList() { return U() === 'lb' ? [45, 35, 25, 10, 5, 2.5] : [25, 20, 15, 10, 5, 2.5, 1.25]; }
  function arrow(dir) {
    if (dir === 'same' || dir === 'mixed') { return '<svg class="ar" viewBox="0 0 10 10" aria-hidden="true"><rect x="1" y="4" width="8" height="2" rx="1"/></svg>'; }
    return '<svg class="ar" viewBox="0 0 10 10" aria-hidden="true"><polygon points="' + (dir === 'up' ? '5,1 9,8 1,8' : '1,2 9,2 5,9') + '"/></svg>';
  }
  function exLogs(exId) { return Store.allLogs().filter(function (l) { return l.e === exId; }); }
  function shortDate(s) { var d = Store.parse(s); return DAYS[d.getDay()].slice(0, 3) + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3); }
  function chartX(x) { var d = new Date(x * 864e5); d = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); return d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3); }
  var VLABEL = { up: 'Won', down: 'Lost', same: 'Draw', mixed: 'Split' };

  function platesHTML(exId) {
    var lb = U() === 'lb', bar = lb ? (barKg === 15 ? 35 : 45) : barKg, total = draft[exId] ? Stats.toU(num(draft[exId].kg)) : 0, r = Stats.plates(total, bar, platesList());
    var h = '<div class="bar-pick" role="group" aria-label="Bar weight">' + [15, 20].map(function (b) { return '<button type="button" class="chip" data-act="bar" data-v="' + b + '" aria-pressed="' + (barKg === b) + '">' + (lb ? (b === 15 ? 35 : 45) : b) + ' ' + U() + ' bar</button>'; }).join('') + '</div>';
    if (!r) { return h + '<p class="pl-text">The bar alone is ' + bar + ' ' + U() + '. Enter a total of at least that.</p>'; }
    var side = r.perSide.length ? r.perSide.map(function (p) { return p.count + ' × ' + kgStr(p.plate); }).join(' + ') : 'no plates';
    return h + '<p class="pl-text"><b>' + kgStr(total) + ' ' + U() + ' total:</b> each side ' + side + '.' + (r.exact ? '' : ' The closest you can load with standard plates is ' + kgStr(r.achieved) + ' ' + U() + '.') + '</p>';
  }

  function dr_kg(sec) { var i = sec.querySelector('[data-f="kg"]'); return i ? i.value : '0'; }

  function historyHTML(ex) {
    var today = Store.today(), ss = Stats.sessions(ex.id, exLogs(ex.id)).filter(function (x) { return x.date !== today; });
    var h = '<div class="fld"><label for="n-' + ex.id + '">Note for this exercise (seat, grip, settings)</label><input id="n-' + ex.id + '" class="text-in" type="text" maxlength="140" data-f="note" data-ex="' + ex.id + '" value="' + esc(Store.note(ex.id)) + '"></div>';
    if (!ss.length) { return h + '<p class="muted" style="margin-top:12px">No earlier sessions yet. Your history appears here after your first workout.</p>'; }
    h += '<h3 style="margin-top:16px">Last sessions</h3><ul class="hist-list">';
    ss.slice(-4).reverse().forEach(function (x, i) {
      var idx = ss.length - 1 - i, prev = ss[idx - 1], cmp = prev ? Stats.compare(x, prev) : null;
      h += '<li><span class="hd">' + shortDate(x.date) + '</span><span class="hs num">' + x.sets.map(function (q) { return q.reps + ' × ' + wStr(q.kg); }).join(', ') + ' ' + U() + '</span>' +
        (cmp ? '<span class="vd ' + cmp.verdict + '">' + arrow(cmp.verdict) + VLABEL[cmp.verdict] + '</span>' : '<span class="vd same">First</span>') +
        '<details class="edit-day"><summary>Edit sets</summary><ul class="edit-sets">' + x.sets.map(function (q) {
          return '<li><input class="text-in num" type="number" inputmode="numeric" min="1" max="100" data-f="er" value="' + q.reps + '" aria-label="Reps"> × <input class="text-in num" type="number" inputmode="decimal" step="0.5" min="0" max="500" data-f="ek" value="' + wStr(q.kg) + '" aria-label="Kg"> kg ' +
            '<button class="btn small" type="button" data-act="set-save" data-id="' + q.id + '">Save</button><button class="link" type="button" data-act="set-del" data-id="' + q.id + '">Delete</button></li>'; }).join('') + '</ul></details></li>';
    });
    h += '</ul>';
    if (ss.length >= 3) {
      var useKg = ss.some(function (x) { return x.topKg > 0; });
      h += '<p class="sub" style="margin-top:12px">' + (useKg ? 'Heaviest set per session (' + U() + ')' : 'Best reps per session') + '</p>' +
        Charts.line(ss.map(function (x) { var y = useKg ? Stats.toU(x.topKg) : x.maxReps; return { x: Store.parse(x.date).getTime() / 864e5, y: y, label: shortDate(x.date) + ': ' + kgStr(y) + (useKg ? ' ' + U() + '' : ' reps') }; }),
          { unit: useKg ? ' ' + U() + '' : ' reps', aria: 'Progress for ' + ex.name, xLabel: chartX });
    }
    return h;
  }

  // a beginner's hint for the very first set of an exercise with no history
  function firstHint(ex) {
    var tip = ex.equip === 'Barbell' ? 'An empty barbell is ' + BAR_NAME() + '. Start with the bar or very light plates' : ex.equip === 'Dumbbells' ? 'Pick the lighter dumbbells (the weight of one)' : ex.equip === 'Machine' ? 'Put the pin near the top of the stack (lightest)' : 'Start with a light weight';
    return tip + ', and choose a weight you can lift about 10 times with good form. You can add weight next session.';
  }
  function loggerHTML(ex) {
    var today = Store.today(), sets = Store.setsFor(today, ex.id), last = Store.lastSession(ex.id, today), all = exLogs(ex.id);
    var dr = draft[ex.id] || (draft[ex.id] = initialDraft(ex, today));
    var h = '';
    if (last) {
      h += '<p class="last">Last time (' + longDate(last.date).replace(/^\w+ /, '') + '): ' + last.sets.map(function (s) { return s.reps + ' × ' + wStr(s.kg); }).join(', ') + ' ' + U() + '</p>';
    }
    if (!last && !sets.length && ex.equip !== 'Bodyweight' && !(dr.kg > 0)) { h += '<p class="first-hint"><b>First time?</b> ' + firstHint(ex) + '</p>'; }
    var tg = !sets.length && last ? Stats.target(ex.reps, Stats.summarize(last.date, last.sets)) : null;
    if (tg) { h += '<p class="target"><b>Target today:</b> ' + tg.reps + ' reps' + (tg.kg > 0 ? ' × ' + wStr(tg.kg) + ' ' + U() + '' : '') + '. ' + esc(tg.why) + '</p>'; }
    if (sets.length) {
      var wn = 0;
      h += '<ol class="sets">' + sets.map(function (s, i) {
        var warm = s.t === 'w', ri = warm ? 0 : ++wn, dl = last && !warm ? Stats.setDelta(s, last.sets[ri - 1]) : null, pr = warm ? null : Stats.prFor(s, all);
        return '<li><span class="sn">' + (warm ? 'Warm-up' : 'Round ' + ri) + (s.t === 'f' ? ' <em class="stag">failure</em>' : s.t === 'd' ? ' <em class="stag">drop</em>' : '') + '</span><span class="sv num">' + s.reps + ' reps × ' + wStr(s.kg) + ' ' + U() + '' +
          (dl ? ' <span class="dl ' + dl.dir + '">' + (dl.dir === 'same' ? '' : arrow(dl.dir)) + dl.text + '</span>' : '') +
          (pr ? ' <span class="prb" title="' + Stats.PR_TEXT[pr] + '">PR</span>' : '') + '</span>' +
          '<button class="rm" type="button" data-act="rm" data-id="' + s.id + '" aria-label="Remove set ' + (i + 1) + '">Remove</button></li>';
      }).join('') + '</ol>';
    }
    var bw = ex.equip === 'Bodyweight', wsets = sets.filter(function (x) { return x.t !== 'w'; }).length;
    h += '<div class="logger">' +
      '<div class="fld"><label for="r-' + ex.id + '">' + (ex.timed ? 'Seconds' : 'Reps') + '</label><div class="stepper"><button type="button" data-act="rep-" aria-label="Fewer reps">−</button>' +
        '<input id="r-' + ex.id + '" class="num" type="number" inputmode="numeric" min="1" step="1" value="' + dr.reps + '" data-f="reps"><button type="button" data-act="rep+" aria-label="More reps">+</button></div></div>' +
      '<div class="fld"><label for="k-' + ex.id + '">' + (U() === 'lb' ? 'Lb' : 'Kg') + (bw ? ' (0 = bodyweight)' : '') + '</label><div class="stepper"><button type="button" data-act="kg-" aria-label="Less weight">−</button>' +
        '<input id="k-' + ex.id + '" class="num" type="number" inputmode="decimal" min="0" step="0.5" value="' + wStr(dr.kg) + '" data-f="kg"><button type="button" data-act="kg+" aria-label="More weight">+</button></div></div>' +
      '<div class="kg-row"><div class="kg-pick" role="group" aria-label="Quick weights in kilograms">' +
        quickKg().map(function (v) { return '<button type="button" class="chip" data-act="kgset" data-v="' + v + '" aria-pressed="' + (dr.kg === v) + '">' + wStr(v) + '</button>'; }).join('') +
        '<button type="button" class="chip more" data-act="menu" aria-haspopup="listbox" aria-expanded="false">More</button></div>' +
        '<div class="lb"><ul class="lb-menu" role="listbox" tabindex="-1" aria-label="Weight in kilograms" hidden>' +
        menuKg().map(function (v) { return '<li role="option" data-act="kgset" data-v="' + v + '" aria-selected="' + (dr.kg === v) + '">' + wStr(v) + ' ' + U() + '</li>'; }).join('') +
        '</ul></div></div>' +
      '<div class="stypes" role="group" aria-label="Set type">' + [['', 'Normal'], ['w', 'Warm-up'], ['f', 'Failure'], ['d', 'Drop']].map(function (t) { return '<button type="button" class="chip" data-act="stype" data-v="' + t[0] + '" aria-pressed="' + ((dr.t || '') === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div>' +
      '<button type="button" class="btn primary block log-btn" data-act="log">' + (dr.t === 'w' ? 'Log warm-up' : 'Log round ' + (wsets + 1)) + '</button></div>';
    var extra = '';
    if (last && sets.length < last.sets.length) { extra += '<button type="button" class="link" data-act="repeat">Repeat last time (' + (last.sets.length - sets.length) + ' more ' + (last.sets.length - sets.length === 1 ? 'set' : 'sets') + ')</button>'; }
    if (ex.equip === 'Barbell') { extra += '<button type="button" class="link" data-act="plates">Plates</button>'; }
    if (ex.equip !== 'Bodyweight') { extra += '<button type="button" class="link" data-act="warm">Warm-up</button>'; }
    if (extra) { h += '<div class="extras">' + extra + '</div><div class="plates" hidden></div><div class="warmup" hidden></div>'; }
    return h;
  }

  function figureHTML(ex) {
    return '<canvas class="pose" tabindex="0" role="img" aria-label="Rotatable 3D figure doing the ' + esc(ex.name) + '. Drag, or use the left and right arrow keys, to turn it."></canvas>' +
      '<p class="hint">Drag the figure to turn it all the way around.</p>' +
      '<div class="views" role="group" aria-label="Camera angle"><button type="button">Front</button><button type="button">Side</button><button type="button">Back</button><button type="button">Top</button><button type="button">Spin</button></div>' +
      '<div class="track" aria-hidden="true"><span>Start</span><div class="bar"><i></i></div><span>End</span></div>' +
      '<div class="seg" role="group" aria-label="' + esc(ex.name) + ' position"><button type="button">Start</button><button type="button">End</button><button type="button">Play</button></div>' +
      '<p class="phase"></p><p class="desc"></p>' +
      '<div class="legend"><span><i class="sw hot"></i>Red: muscle working</span><span><i class="sw arrow"></i>Dashed line: path of the weights</span></div>';
  }

  function guideHTML(ex) {
    if (ex.custom) { return '<div class="guide-body"><p class="fig-note">This is your own exercise, so there is no figure or form text. Add a note under History and notes to remember your setup.</p><button class="link" type="button" data-act="del-custom" data-id="' + ex.id + '">Delete this exercise</button></div>'; }
    return '<div class="guide-body"><div class="g-fig">' + machineBlock(ex) +
      (ex.fig ? '<div class="fig" data-fig="' + ex.id + '">' + figureHTML(ex) + '</div>'
              : '<p class="fig-note">3D form animation for this exercise is coming. Use the steps below for now.</p>') + '</div><div class="g-info">' +
      '<div class="muscles" data-view="' + ex.mus.view + '"><h3>Muscles worked</h3><div class="mtoggle" role="group" aria-label="Muscle view"><button type="button" data-mv="front">Front</button><button type="button" data-mv="back">Back</button></div>' +
      '<canvas class="mmap" role="img" aria-label="3D body with ' + esc(ex.mus.main) + ' highlighted"></canvas>' +
      '<p class="mrow"><i class="dot hot"></i><span><b>Main:</b> ' + esc(ex.mus.main) + '</span></p>' +
      '<p class="mrow"><i class="dot warm"></i><span><b>Helping:</b> ' + esc(ex.mus.help) + '</span></p></div>' +
      '<p class="step"><b>How:</b> ' + esc(ex.how) + '</p><p class="step avoid"><b>Avoid:</b> ' + esc(ex.avoid) + '</p></div></div>';
  }

  // what the equipment looks like, so the user can confirm the gym has it
  function machineBlock(ex) {
    // the 3D figure already shows the machine, so the flat drawing is only a fallback for exercises without one
    return Machines.has(ex.id) ? '<div class="mach">' + (ex.fig ? '' : Machines.svg(ex)) + '<p class="look"><b>Look for:</b> ' + esc(ex.look) + '</p></div>' : '';
  }

  /* ----- one exercise at a time, with a rail to jump around ----- */
  function skipped() { try { var o = JSON.parse(localStorage.getItem('gymtracker.skip')); return o && o.d === Store.today() ? o.ids : []; } catch (e) { return []; } }
  function setSkipped(ids) { try { localStorage.setItem('gymtracker.skip', JSON.stringify({ d: Store.today(), ids: ids })); } catch (e) {} }
  function exStatus(ex, t) {
    var n = Store.workSets(t, ex.id).length, sk = skipped().indexOf(ex.id) >= 0;
    return n >= ex.sets ? { cls: 'done', txt: 'Done' } : n ? { cls: 'part', txt: n + ' / ' + ex.sets } : sk ? { cls: 'skip', txt: 'Skipped' } : { cls: '', txt: ex.sets + ' rounds' };
  }
  function viewWorkout(id, arg2) {
    var m = Data.MUSCLES[id];
    if (!m) { return '<a class="crumb" href="#/today">Back to today</a><h1>Not found</h1>'; }
    var exs = visibleEx(id), t = Store.today(), planned = Data.planAll(Store.parse(t).getDay()).indexOf(id) >= 0;
    var h = '<a class="crumb" href="#/today">Back to today</a><h1>' + m.name + '</h1><p class="intro">' + (planned ? 'Planned for today. ' : '') + esc(m.blurb) + ' <a class="link" href="#/plan/' + id + '">Edit exercises</a></p>';
    if (!exs.length) { return h + '<p class="empty">All exercises for this muscle are switched off. Turn some on in the Plan tab.</p>'; }
    // which one: the number in the link, else the first one not finished or skipped
    var idx = parseInt(arg2, 10) - 1, sk = skipped();
    if (!(idx >= 0 && idx < exs.length)) { idx = 0; for (var q = 0; q < exs.length; q++) { if (Store.workSets(t, exs[q].id).length < exs[q].sets && sk.indexOf(exs[q].id) < 0) { idx = q; break; } } }
    var ex = exs[idx], i = idx, last = idx === exs.length - 1;
    var todays = Data.planAll(Store.parse(t).getDay()), nm = todays[todays.indexOf(id) + 1] || (todays.indexOf(id) < 0 ? '' : ''), nextM = nm && visibleEx(nm).length ? nm : '';
    h += '<div class="wk"><nav class="rail" aria-label="Exercises in this workout"><ol>' + exs.map(function (e, k) {
      var st = exStatus(e, t);
      return '<li><a class="ri ' + st.cls + (k === idx ? ' on' : '') + '" href="#/m/' + id + '/' + (k + 1) + '"' + (k === idx ? ' aria-current="step"' : '') + '><span class="rn">' + (st.cls === 'done' ? '✓' : k + 1) + '</span>' + thumbHTML(e, 'rt') + '<span class="rx"><b>' + esc(e.name) + '</b><small>' + st.txt + '</small></span></a></li>';
    }).join('') + '</ol></nav><div class="wk-main">';
    Sess.start();
    h += '<p class="wk-pos">Exercise ' + (idx + 1) + ' of ' + exs.length + ' · Session <span class="num" id="sess-t">0:00</span></p>';
    h += '<div class="ex-tools" role="group" aria-label="Change this exercise"><button type="button" class="link" data-act="mv-up" data-id="' + ex.id + '"' + (idx === 0 ? ' disabled' : '') + '>Move up</button><button type="button" class="link" data-act="mv-down" data-id="' + ex.id + '"' + (last ? ' disabled' : '') + '>Move down</button><button type="button" class="link" data-act="swap-open" data-id="' + ex.id + '">Swap</button></div>';
    h += '<section class="ex" data-ex="' + ex.id + '"><div class="ex-head"><span class="ex-n">' + (i + 1) + '</span><div>' + (i === 0 ? '<span class="badge">Main event</span>' : '') + '<h2>' + esc(ex.name) + '</h2>' +
      '<p class="ex-meta"><b>' + ex.sets + ' rounds of ' + esc(ex.reps) + (ex.timed ? ' seconds' : ' reps') + '</b>, ' + ex.equip.toLowerCase() + '. ' + esc(ex.target) + '</p>' +
      (Store.isSuper(ex.id) && i ? '<p class="ss-tag">Superset: do it right after the exercise above, then rest.</p>' : '') + '<p class="ex-note" data-note-for="' + ex.id + '"' + (Store.note(ex.id) ? '' : ' hidden') + '>Note: ' + esc(Store.note(ex.id)) + '</p></div></div>' +
      '<div class="ex-log">' + loggerHTML(ex) + '</div>' +
      '<details class="guide hist" data-ex="' + ex.id + '"><summary>History and notes</summary><div class="guide-body">' + historyHTML(ex) + '</div></details>' +
      '<details class="guide" data-ex="' + ex.id + '"><summary>Form guide</summary>' + guideHTML(ex) + '</details></section>';
    h += '<div class="wk-nav">' + (idx > 0 ? '<a class="btn" href="#/m/' + id + '/' + idx + '">‹ Previous</a>' : '<span></span>') +
      '<button class="btn" type="button" data-act="wk-skip" data-id="' + ex.id + '" data-to="' + (last ? (nextM ? nextM + '/1' : '') : id + '/' + (idx + 2)) + '">Skip</button>' +
      (last && nextM ? '<a class="btn primary" data-act="wk-next" href="#/m/' + nextM + '/1">Next: ' + mName(nextM) + ' ›</a>' : last ? '<a class="btn primary" data-act="wk-next" href="#/summary/' + id + '">Finish workout</a>' : '<a class="btn primary" data-act="wk-next" href="#/m/' + id + '/' + (idx + 2) + '">Next: ' + esc(exs[idx + 1].name) + ' ›</a>') + '</div>';
    h += '<div class="finish"><h3>Finished early?</h3><p class="summary" id="sum">' + summaryText(id) + '</p><div class="today-actions"><a class="btn small" href="#/summary/' + id + '">Finish workout</a></div></div>';
    h += '<p class="safety">Listen to your body. Stop an exercise if you feel sharp pain, and ask a trainer to check your form on heavy lifts.</p></div></div>';
    return h;
  }
  function summaryText(muscle) {
    var logs = Store.logsOn(Store.today()).filter(function (l) { return l.m === muscle; });
    return logs.length ? logs.length + ' rounds logged, ' + Math.round(Store.volume(logs)).toLocaleString() + ' ' + U() + ' lifted so far.' : 'Nothing logged yet. Your rounds save as you go.';
  }

  /* =========================================================  SUMMARY  */
  var summaryText_ = '';
  function viewSummary(muscle) {
    var t = Store.today(), logs = Store.logsOn(t).filter(function (l) { return l.m === muscle; }).sort(function (a, b) { return a.ts - b.ts; });
    if (!logs.length) { return '<a class="crumb" href="#/m/' + muscle + '">Back to workout</a><h1>Nothing logged</h1><p class="intro">Log at least one set and your summary appears here.</p>'; }
    var ids = [], all = Store.allLogs();
    logs.forEach(function (l) { if (ids.indexOf(l.e) < 0) { ids.push(l.e); } });
    Sess.end(); var mins = Sess.get() && Sess.ms() > 60000 ? Math.round(Sess.ms() / 60000) : (logs.length > 1 ? Math.max(1, Math.round((logs[logs.length - 1].ts - logs[0].ts) / 60000)) : 0);
    var rows = '', beat = 0, compared = 0, prs = [];
    ids.forEach(function (id) {
      var ex = Data.byId[id], ss = Stats.sessions(id, all), cur = ss.filter(function (x) { return x.date === t; })[0], prev = ss.filter(function (x) { return x.date < t; }).pop();
      var line = prev ? Stats.compare(cur, prev) : null;
      if (prev) { compared++; if (line.verdict === 'up') { beat++; } }
      cur.sets.forEach(function (st) { var pr = Stats.prFor(st, exLogs(id)); if (pr) { prs.push({ name: ex ? ex.name : id, text: Stats.PR_TEXT[pr], set: st }); } });
      rows += '<li><span class="hd">' + (ex ? '<a class="plain" href="#/m/' + ex.muscle + '">' + esc(ex.name) + '</a>' : esc(id)) + '</span><span class="hs num">' + cur.sets.map(function (q) { return q.reps + ' × ' + wStr(q.kg); }).join(', ') + ' ' + U() + '</span>' +
        (line ? '<span class="vd ' + line.verdict + '">' + arrow(line.verdict) + VLABEL[line.verdict] + '</span><span class="vtext">' + esc(line.text) + '</span>' : '<span class="vd same">First</span><span class="vtext">First time logged. This is your starting point.</span>') + '</li>';
    });
    var vol = Math.round(Store.volume(logs));
    var h = '<a class="crumb" href="#/m/' + muscle + '">Back to workout</a><h1>' + mName(muscle) + ' done</h1>' +
      '<div class="stats"><div><b class="num">' + logs.length + '</b><span>Sets</span></div><div><b class="num">' + vol.toLocaleString() + '</b><span>Kg lifted</span></div>' + (mins ? '<div><b class="num">' + mins + '</b><span>Minutes</span></div>' : '') + '<div><b class="num">' + Stats.calories(logs, Store.currentKg()) + '</b><span>Kcal (estimate)</span></div></div>';
    if (compared) { h += '<p class="lead" style="margin-top:18px"><b>' + (beat ? 'Won ' + beat + ' of ' + compared + ' bouts against last time.' : 'No wins against last time today. Rest and aim for it next session.') + '</b></p>'; }
    if (prs.length) { h += '<div class="sec"><h2>Personal records</h2><ul class="hist-list">' + prs.map(function (p) { return '<li><span class="hd">' + esc(p.name) + ' <button type="button" class="plain share-mini" data-act="share-pr" data-e="' + p.set.e + '" data-id="' + p.set.id + '">Share</button></span><span class="hs num">' + p.set.reps + ' × ' + wStr(p.set.kg) + ' ' + U() + '</span><span class="prb">PR</span><span class="vtext">' + p.text + '</span></li>'; }).join('') + '</ul></div>'; }
    h += '<div class="sec"><h2>Exercises</h2><ul class="hist-list">' + rows + '</ul></div>';
    summaryText_ = mName(muscle) + ' day, ' + shortDate(t) + ': ' + logs.length + ' sets, ' + vol.toLocaleString() + ' ' + U() + ' lifted' + (mins ? ', about ' + mins + ' min' : '') + ', about ' + Stats.calories(logs, Store.currentKg()) + ' kcal.' +
      (compared ? ' Won ' + beat + ' of ' + compared + ' bouts against last time.' : '') + (prs.length ? ' PRs: ' + prs.map(function (p) { return p.name + ' (' + wStr(p.set.kg) + ' ' + U() + ' x ' + p.set.reps + ')'; }).join(', ') + '.' : '');
    return h + '<div class="today-actions"><a class="btn primary" href="#/today">Done</a><button class="btn" type="button" data-act="share-workout" data-m="' + muscle + '">Share</button></div>';
  }

  /* =========================================================  PROGRESS HELPERS  */
  var progMode = 'session';
  function howSection() {
    var logs = Store.allLogs(), ids = [];
    logs.forEach(function (l) { if (ids.indexOf(l.e) < 0) { ids.push(l.e); } });
    var rows = Stats.progress(logs, ids, progMode, Store.today(), Store.addDays);
    var modes = [['session', 'Last session'], ['7', '7 days'], ['30', '30 days']];
    var h = '<div class="sec"><h2>How you are doing</h2><div class="modes" role="group" aria-label="Compare period">' +
      modes.map(function (m) { return '<button type="button" class="chip" data-act="mode" data-v="' + m[0] + '" aria-pressed="' + (String(progMode) === m[0]) + '">' + m[1] + '</button>'; }).join('') + '</div>' +
      '<p class="sub" style="margin-top:8px">' + (progMode === 'session' ? 'Your latest session of each exercise compared with the session before it.' : 'The last ' + progMode + ' days compared with the ' + progMode + ' days before that.') + '</p>';
    if (!rows.length) { return h + '<p class="empty">' + (progMode === 'session' ? 'Do an exercise in two different workouts and this compares them.' : 'Not enough data yet. This needs sets in both periods.') + '</p></div>'; }
    var count = { up: 0, same: 0, down: 0, mixed: 0 }; rows.forEach(function (r) { count[r.verdict]++; });
    h += '<p class="lead" style="margin-top:12px"><b>' + count.up + ' up, ' + count.same + ' same, ' + count.down + ' down' + (count.mixed ? ', ' + count.mixed + ' mixed' : '') + '</b></p>';
    [['up', 'Going up'], ['mixed', 'Mixed'], ['down', 'Slipping'], ['same', 'Holding steady']].forEach(function (g) {
      var list = rows.filter(function (r) { return r.verdict === g[0]; });
      if (!list.length) { return; }
      h += '<h3 style="margin-top:18px">' + g[1] + '</h3><ul class="hist-list">' + list.map(function (r) {
        var ex = Data.byId[r.id];
        return '<li><span class="hd">' + esc(ex ? ex.name : r.id) + '</span><span class="vd ' + r.verdict + '">' + arrow(r.verdict) + VLABEL[r.verdict] + '</span><span class="vtext">' + esc(r.text) + '</span></li>';
      }).join('') + '</ul>';
    });
    return h + '</div>';
  }
  function recordsSection() {
    var logs = Store.allLogs(), list = [];
    Data.EX.forEach(function (ex) { var b = Stats.records(ex.id, logs); if (b) { list.push({ ex: ex, b: b }); } });
    if (!list.length) { return ''; }
    var row = function (x) { return '<li><span class="hd"><button type="button" class="plain" data-act="prog-go" data-id="' + x.ex.id + '">' + esc(x.ex.name) + '</button></span><span class="hs num">' + (x.b.kg > 0 ? wStr(x.b.kg) + ' ' + U() + ' × ' + x.b.reps : x.b.reps + ' reps') + '</span><span class="vtext">' + shortDate(x.b.d) + '</span></li>'; };
    return '<div class="sec" id="sec-records"><h2>Personal records</h2><p class="sub">Your heaviest set for each exercise.</p><ul class="hist-list">' + list.slice(0, 6).map(row).join('') + '</ul>' +
      (list.length > 6 ? '<details class="more-list"><summary>Show all ' + list.length + '</summary><ul class="hist-list">' + list.slice(6).map(row).join('') + '</ul></details>' : '') + '</div>';
  }

  /* =========================================================  CALENDAR  */
  function viewCalendar(arg) {
    var t = Store.today();
    if (!calState) { var td = Store.parse(t); calState = { y: td.getFullYear(), m: td.getMonth(), sel: t }; }
    if (arg && /^\d{4}-\d{2}-\d{2}$/.test(arg)) { var pd = Store.parse(arg); calState = { y: pd.getFullYear(), m: pd.getMonth(), sel: arg }; }
    var y = calState.y, mo = calState.m, first = new Date(y, mo, 1), lead = (first.getDay() + 6) % 7, n = new Date(y, mo + 1, 0).getDate();
    var h = '<h1>Calendar</h1><div class="cal-wrap"><div class="cal-l"><div class="cal-head"><h2>' + MONTHS[mo] + ' ' + y + '</h2><div class="cal-nav"><button type="button" data-act="cal-prev" aria-label="Previous month">‹</button><button type="button" data-act="cal-next" aria-label="Next month">›</button></div></div>';
    h += '<div class="cal" role="grid">' + ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(function (d) { return '<div class="dow">' + d + '</div>'; }).join('');
    for (var i = 0; i < lead; i++) { h += '<div class="cd blank"></div>'; }
    var doneN = 0, planN = 0;
    for (var d = 1; d <= n; d++) {
      var ds = y + '-' + (mo + 1 < 10 ? '0' : '') + (mo + 1) + '-' + (d < 10 ? '0' : '') + d, inf = Store.dayInfo(ds);
      var shownAll = inf.trained.length ? inf.trained : inf.plannedAll, shown = shownAll[0];
      if (inf.kind === 'done' || inf.kind === 'missed' || inf.kind === 'madeup') { planN += inf.planned ? 1 : 0; doneN += (inf.kind === 'done' || inf.kind === 'madeup') && inf.planned ? 1 : 0; }
      h += '<button type="button" class="cd ' + inf.kind + (ds === t ? ' today' : '') + '" data-act="day" data-d="' + ds + '" aria-pressed="' + (ds === calState.sel) + '" aria-label="' +
        longDate(ds) + (shown ? ', ' + mList(shownAll) : ', rest') + ', ' + inf.kind + '">' + d + (shown && inf.kind !== 'none' ? '<small>' + mShort(shown) + (shownAll.length > 1 ? ' +' + (shownAll.length - 1) : '') + '</small>' : '') + '</button>';
    }
    h += '</div><div class="cal-legend"><span><i class="lg done"></i>Trained</span><span><i class="lg missed"></i>No show</span><span><i class="lg madeup"></i>Made up later</span><span><i class="lg"></i>Planned or rest</span></div>';
    h += '<p class="muted" style="margin-top:10px">' + doneN + ' of ' + planN + ' planned days done this month so far.</p>';
    h += '</div>' + dayDetail(calState.sel) + '</div>';
    return h;
  }
  function dayDetail(ds) {
    var inf = Store.dayInfo(ds), logs = Store.logsOn(ds), t = Store.today();
    var h = '<div class="day-detail" id="detail"><h3>' + longDate(ds) + '</h3>';
    if (logs.length) {
      var byEx = {}, order = [];
      logs.sort(function (a, b) { return a.ts - b.ts; }).forEach(function (l) { if (!byEx[l.e]) { byEx[l.e] = []; order.push(l.e); } byEx[l.e].push(l); });
      h += '<p class="muted">' + logs.length + ' sets, ' + Math.round(Store.volume(logs)).toLocaleString() + ' ' + U() + ' lifted.</p><ul>' + order.map(function (id) {
        var ex = Data.byId[id];
        return '<li>' + (ex ? '<a class="plain" href="#/m/' + ex.muscle + '">' + esc(ex.name) + '</a>' : esc(id)) + '<small class="num">' + byEx[id].map(function (s) { return s.reps + ' × ' + wStr(s.kg); }).join(', ') + ' ' + U() + '</small></li>';
      }).join('') + '</ul>';
    } else if (inf.kind === 'madeup') { h += '<p class="muted">Planned ' + mList(inf.plannedAll) + ', trained later that week.</p>';
    } else if (inf.kind === 'missed') { h += '<p class="muted">No show. ' + mList(inf.plannedAll) + ' was planned, nothing logged.</p>'; }
    else if (inf.kind === 'rest') { h += '<p class="muted">Rest day.</p>'; }
    else if (inf.kind === 'upcoming') { h += '<p class="muted">Planned: ' + mList(inf.plannedAll) + '.</p>'; }
    else if (inf.kind === 'today') { h += '<p class="muted">Planned: ' + mList(inf.plannedAll) + '.</p><div class="today-actions">' + inf.plannedAll.map(function (m) { return '<a class="btn primary" href="#/m/' + m + '">Start ' + mName(m).toLowerCase() + '</a>'; }).join('') + '</div>'; }
    else { h += '<p class="muted">Before you started tracking.</p>'; }
    return h + '</div>';
  }

  // a compact "tonight" card at the top of Home that opens the Today page
  function tonightStrip(t) {
    var info = Store.dayInfo(t), plans = info.plannedAll;
    if (info.kind === 'done') { return '<a class="tonight done" href="#/today"><span class="badge red">' + (leftToday(info).length ? 'Halftime' : 'Fight over') + '</span><b>' + esc(info.trained.map(mName).join(' + ')) + ' done today</b><span class="go">See today\'s card ›</span></a>'; }
    if (!plans.length) { var nx = nextCard(t); return '<a class="tonight" href="#/today"><span class="badge">Rest day</span><b>' + (nx ? 'Next: ' + DAYS[Store.parse(nx.date).getDay()] + ', ' + mName(nx.muscle) : 'Nothing planned') + '</b><span class="go">Open Today ›</span></a>'; }
    return '<a class="tonight" href="#/today"><span class="badge">Today</span><b>' + plans.map(mName).join(' + ') + ' day · about ' + sessionMinutes(plans) + ' min</b><span class="go">Enter the ring ›</span></a>';
  }

  // before the first workout there are no numbers to show: say what to do instead
  function welcomeHTML(t) {
    var info = Store.dayInfo(t), nx = info.plannedAll.length ? { date: t, muscle: info.plannedAll[0] } : nextCard(t);
    var when = nx ? (nx.date === t ? 'today: ' + mList(info.plannedAll) : DAYS[Store.parse(nx.date).getDay()] + ': ' + mName(nx.muscle)) : '';
    return '<div class="lab"><span>Welcome</span><span></span></div><h3>Your first workout is ' + (when || 'whenever you are ready') + '</h3><p class="muted" style="margin-top:8px;max-width:54ch">Your stats, streak and charts fill in as you log. Open Today, start with the first exercise and log each round as you go.</p><div class="today-actions"><a class="btn primary" href="#/today">Go to Today</a></div>';
  }

  /* =========================================================  PROGRESS  */
  function viewProgress() {
    var t = Store.today(), p = Store.profile(), ws = Store.weights();
    var P = dashParts(t);
    var first = !Store.allLogs().length;
    var h = '<h1>Home</h1>' + tonightStrip(t) + installCard() + '<div class="dash over"><section class="d-card d-stats">' + (first ? welcomeHTML(t) : P.stats) + '</section><section class="tape">' + P.tape + '</section><section class="d-card d-week">' + P.week + '</section><section class="d-card d-last">' + P.last + '</section><section class="d-card d-bal" id="sec-balance">' + P.bal + '</section></div>' + howSection() + recordsSection() + measuresSection() + friendsSection() + '<div class="sec" id="sec-weight"><h2>Body weight</h2><p class="sub">Goal ' + wStr(p.goalKg) + ' ' + U() + '. Weigh in at the same time of day for a clear trend.</p>';
    if (ws.length >= 2) {
      h += Charts.line(ws.map(function (w) { return { x: Store.parse(w.d).getTime() / 864e5, y: Stats.toU(w.kg), label: longDate(w.d) + ': ' + wStr(w.kg) + ' ' + U() + '' }; }),
        { goal: Stats.toU(p.goalKg), unit: ' ' + U() + '', aria: 'Body weight over time, latest ' + wStr(ws[ws.length - 1].kg) + ' ' + (U() === 'lb' ? 'pounds' : 'kilograms') + ', goal ' + wStr(p.goalKg),
          xLabel: function (x) { var d = new Date(x * 864e5); d = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); return d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3); } });
    } else { h += '<p class="empty">Add a second weigh-in and your trend line appears here.</p>'; }
    var tr = Stats.trend(ws, p.goalKg, t);
    if (tr) {
      var lose = tr.perWeek < 0, pace = wStr(Math.abs(tr.perWeek)) + ' ' + U() + ' a week ' + (lose ? 'down' : 'up');
      h += '<p class="trend">Trend: ' + pace + ', about ' + wStr(tr.nowKg) + ' ' + U() + ' today. ' +
        (tr.etaDays === 0 ? 'You are at your goal.' : tr.etaDays ? 'At this pace you reach ' + wStr(p.goalKg) + ' ' + U() + ' around ' + longDate(Store.addDays(t, tr.etaDays)) + '.' : 'You are moving away from your goal weight right now.') + '</p>';
    } else if (ws.length >= 2) { h += '<p class="trend">Three weigh-ins over at least a week show your pace and goal date.</p>'; }
    h += '<form class="row-form" data-form="weight"><div class="fld"><label for="wd">Date</label><input id="wd" class="text-in" type="date" value="' + t + '" max="' + t + '"></div>' +
      '<div class="fld"><label for="wk">Weight (' + U() + ')</label><input id="wk" class="text-in num" type="number" inputmode="decimal" step="0.1" min="20" max="900" value="' + wStr(Store.currentKg()) + '"></div>' +
      '<button class="btn primary" type="submit">Save</button></form></div>';

    var weeks = [], cur = weekStart(t), i;
    for (i = 7; i >= 0; i--) {
      var s = Store.addDays(cur, -7 * i), e = Store.addDays(s, 6), seen = {};
      Store.allLogs().forEach(function (l) { if (l.d >= s && l.d <= e) { seen[l.d] = 1; } });
      weeks.push({ label: Store.parse(s).getDate() + '/' + (Store.parse(s).getMonth() + 1), value: Object.keys(seen).length });
    }
    h += '<div class="sec"><h2>Workouts per week</h2><p class="sub">Days trained, last 8 weeks (week start date below each bar). Your plan is ' + Data.trainingDays() + ' a week.</p>' +
      Charts.bars(weeks, { max: Math.max(Data.trainingDays(), 1), aria: 'Workouts per week for the last 8 weeks' }) + '</div>';


    var ids = {}; Store.allLogs().forEach(function (l) { ids[l.e] = 1; });
    var list = Data.EX.filter(function (e) { return ids[e.id]; });
    h += '<div class="sec" id="sec-progress"><h2>Exercise progress</h2>';
    if (!list.length) { h += '<p class="empty">Log a set in any workout and its chart appears here.</p></div>'; return h; }
    var sel = progSel && ids[progSel] ? progSel : list[0].id;
    h += '<div class="fld" style="margin-top:12px"><label for="pe">Exercise</label><select id="pe" class="text-in" data-f="prog">' +
      list.map(function (e) { return '<option value="' + e.id + '"' + (e.id === sel ? ' selected' : '') + '>' + esc(e.name) + '</option>'; }).join('') + '</select></div>';
    var byDay = {};
    Store.allLogs().filter(function (l) { return l.e === sel; }).forEach(function (l) { var o = byDay[l.d] || (byDay[l.d] = { max: 0, vol: 0 }); o.max = Math.max(o.max, Stats.toU(l.kg)); o.vol += l.reps * Stats.toU(l.kg); });
    var days = Object.keys(byDay).sort();
    var xf = function (x) { var d = new Date(x * 864e5); d = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); return d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3); };
    if (days.length >= 2) {
      h += '<p class="sub" style="margin-top:14px">Heaviest set (' + U() + ')</p>' + Charts.line(days.map(function (d) { return { x: Store.parse(d).getTime() / 864e5, y: byDay[d].max, label: longDate(d) + ': ' + kgStr(byDay[d].max) + ' ' + U() + '' }; }), { unit: ' ' + U() + '', aria: 'Heaviest set per session', xLabel: xf });
      h += '<p class="sub" style="margin-top:14px">Total volume per session (reps × ' + U() + ')</p>' + Charts.line(days.map(function (d) { return { x: Store.parse(d).getTime() / 864e5, y: Math.round(byDay[d].vol), label: longDate(d) + ': ' + Math.round(byDay[d].vol) + ' ' + U() + '' }; }), { unit: '', aria: 'Total volume per session', xLabel: xf });
    } else {
      var only = byDay[days[0]];
      h += '<p class="empty">One session so far: heaviest set ' + kgStr(only.max) + ' ' + U() + ', ' + Math.round(only.vol) + ' ' + U() + ' total volume. Train it again and the chart starts.</p>';
    }
    return h + '</div>';
  }
  var progSel = '';

  /* =========================================================  PLAN  */
  function isDark() {
    var t = document.documentElement.getAttribute('data-theme');
    return t ? t === 'dark' : !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }
  function viewPlan(openId) {
    var p = Store.profile();
    var h = '<h1>Plan</h1><p class="intro">Set your week, then pick the exercises you want in each muscle. Barbell and dumbbell moves lead. Switch off anything your gym does not have.</p>' +
      '<details class="sec fold" open><summary><span class="fh"><h2>Your week</h2><small>' + weekSummary() + '</small></span></summary>' + scheduleHTML() + '<p class="lab" style="margin-top:18px"><span>Equipment you have</span></p>' + equipHTML() + '</details>';
    Data.ORDER.forEach(function (id) {
      var m = Data.MUSCLES[id];
      var onN = Data.exercisesFor(id).filter(function (e) { return !Store.isHidden(e.id); }).length, allN = Data.exercisesFor(id).length;
      h += '<details class="plan-day fold" id="pd-' + id + '"' + (openId === id ? ' open' : '') + '><summary><span class="fh"><h2>' + m.name + '</h2><small>' + daysText(id) + ' · ' + onN + ' of ' + allN + ' exercises on</small></span></summary><p class="fold-actions"><a class="link" href="#/m/' + id + '">Train ' + m.name.toLowerCase() + ' now</a></p>';
      Data.exercisesFor(id).forEach(function (ex, xi) {
        var off = Store.isHidden(ex.id);
        h += '<div class="plan-item"><div class="plan-ex' + (off ? ' off' : '') + '"><label><input type="checkbox" data-f="inc" data-id="' + ex.id + '"' + (off ? '' : ' checked') + '><span class="nm">' + esc(ex.name) + '</span></label>' +
          '<span class="tg' + (ex.confirm ? ' cf' : '') + '">' + ex.equip + (ex.confirm ? ', to confirm' : '') + '</span></div>' +
          (xi ? '<label class="ss"><input type="checkbox" data-f="super" data-id="' + ex.id + '"' + (Store.isSuper(ex.id) ? ' checked' : '') + '> Superset with the exercise above (no rest between)</label>' : '') +
          '</div>';
      });
      h += '</details>';
    });
    h += '<details class="sec fold"><summary><span class="fh"><h2>Add your own exercise</h2></span></summary><p class="sub">For a move that is not in the list. It appears under the muscle you pick and syncs with your account. History stays if you hide it later.</p>' +
      '<div class="fld"><label for="cx-q">Search the exercise library (needs internet)</label><input id="cx-q" class="text-in" type="search" data-f="lib" placeholder="e.g. cable fly"></div><div id="cx-res" class="lib-res"></div>' +
      '<form class="row-form" data-form="custom"><div class="fld"><label for="cx-n">Name</label><input id="cx-n" class="text-in" maxlength="40" required></div>' +
      '<div class="fld"><label for="cx-m">Muscle</label><select id="cx-m" class="text-in">' + Data.ORDER.map(function (g) { return '<option value="' + g + '">' + mName(g) + '</option>'; }).join('') + '</select></div>' +
      '<div class="fld"><label for="cx-e">Equipment</label><select id="cx-e" class="text-in">' + ['Dumbbells', 'Barbell', 'Machine', 'Bodyweight', 'Timed'].map(function (q) { return '<option>' + q + '</option>'; }).join('') + '</select></div>' +
      '<div class="fld"><label for="cx-s">Sets</label><input id="cx-s" class="text-in num" type="number" min="1" max="10" value="3"></div>' +
      '<div class="fld"><label for="cx-r">Reps</label><input id="cx-r" class="text-in" maxlength="8" value="10-12"></div>' +
      '<button class="btn primary" type="submit">Add</button></form></details>';
    h += '<details class="sec fold"><summary><span class="fh"><h2>Your goal</h2></span></summary><div class="row-form"><div class="fld"><label for="sk">Starting weight (' + U() + ')</label><input id="sk" class="text-in num" type="number" inputmode="decimal" step="0.1" value="' + wStr(p.startKg) + '"></div>' +
      '<div class="fld"><label for="gk">Goal weight (' + U() + ')</label><input id="gk" class="text-in num" type="number" inputmode="decimal" step="0.1" value="' + wStr(p.goalKg) + '"></div>' +
      '<button class="btn primary" type="button" data-act="save-goal">Save</button></div></details>';
    h += '<details class="sec fold"><summary><span class="fh"><h2>Workout settings</h2><small>Units, screen</small></span></summary><p class="lab" style="margin-top:6px"><span>Weight unit</span></p>' + unitChips() +
      '<div class="switch" style="margin-top:14px"><span id="aw-l">Keep the screen on during a workout</span><button type="button" role="switch" aria-checked="' + (localStorage.getItem('gymtracker.awake') !== 'off') + '" aria-labelledby="aw-l" data-act="awake"></button></div></details>';
    var rc = Rest.cfg();
    h += '<details class="sec fold"><summary><span class="fh"><h2>Rest timer</h2></span></summary><div class="switch"><span id="rt-l">Start a timer after each set</span><button type="button" role="switch" aria-checked="' + rc.on + '" aria-labelledby="rt-l" data-act="rest-on"></button></div>' +
      '<div class="modes five" role="group" aria-label="Rest length" style="margin-top:8px">' + ['smart', 60, 90, 120, 180].map(function (v) { return '<button type="button" class="chip" data-act="rest-sec" data-v="' + v + '" aria-pressed="' + (v === 'smart' ? rc.smart !== false : rc.smart === false && rc.sec === v) + '">' + (v === 'smart' ? 'Smart' : v + ' s') + '</button>'; }).join('') + '</div><p class="muted small-note">Smart: 2 to 3 minutes after big lifts like squats and bench, about 75 seconds after small ones. If you add time with +15 s, it remembers that for the exercise.</p></details>';
    h += '<details class="sec fold"><summary><span class="fh"><h2>Workout reminders</h2><small>Add to your calendar</small></span></summary><p class="sub">Adds your training days to your phone or computer calendar as weekly events with a reminder 15 minutes before.</p><div class="row-form"><div class="fld"><label for="rm-t">Time</label><input id="rm-t" class="text-in" type="time" value="' + (localStorage.getItem('gymtracker.remind') || '18:00') + '"></div><button class="btn small" type="button" data-act="ics">Add to my calendar</button></div></details>';
    h += '<details class="sec fold"><summary><span class="fh"><h2>Appearance</h2></span></summary><div class="switch"><span id="dm-l">Dark mode</span><button type="button" role="switch" aria-checked="' + isDark() + '" aria-labelledby="dm-l" data-act="theme"></button></div></details>';
    h += '<details class="sec fold"><summary><span class="fh"><h2>Request a feature or an exercise</h2></span></summary><p class="sub">Tell me what you want added. It opens a prefilled note on GitHub, or you can copy the text and send it to me.</p>' +
      '<div class="fld"><label for="rq-t">What is it?</label><select id="rq-t" class="text-in"><option>Feature</option><option>Exercise</option><option>Problem with something</option></select></div>' +
      '<div class="fld" style="margin-top:8px"><label for="rq-x">Describe it</label><textarea id="rq-x" class="text-in" rows="3" maxlength="500" placeholder="e.g. Add cable fly for chest, or: show my weekly volume per muscle"></textarea></div>' +
      '<div class="btns" style="margin-top:10px"><button class="btn small" type="button" data-act="req-send">Open on GitHub</button><button class="link" type="button" data-act="req-copy">Copy text</button></div></details>';
    if (Install.available()) { h += '<details class="sec fold"><summary><span class="fh"><h2>Install as an app</h2></span></summary><p class="sub">Open it full screen from your home screen or desktop, and use it offline.</p><div class="btns"><button class="btn small" type="button" data-act="install-open">Show me how</button></div></details>'; }
    h += '<details class="sec fold"><summary><span class="fh"><h2>Account</h2></span></summary><p>Signed in as <b>' + esc(Store.user()) + '</b>. <button class="link" type="button" data-act="copy-name">Copy</button></p><p class="small-note">This username is the only key to your workouts. Keep it somewhere safe and private: you need it to sign in on another phone, and anyone who knows it can open your data.</p><p class="sub" id="sync-state">' + esc(syncText()) + '</p>' +
      '<div class="btns"><button class="btn small" type="button" data-act="sync-now">Sync now</button><button class="link" type="button" data-act="switch-user">Switch user</button></div></details>';
    h += '<details class="sec fold"><summary><span class="fh"><h2>Your data</h2></span></summary><p class="sub">Saved on this device and copied to the cloud when online. You can also export a backup file.</p>' +
      '<div class="btns"><button class="btn small" type="button" data-act="csv" data-k="workouts">Export workouts (CSV)</button><button class="btn small" type="button" data-act="csv" data-k="weights">Export weights (CSV)</button><button class="btn small" type="button" data-act="export">Backup (JSON)</button><label class="btn small" for="imp" style="cursor:pointer">Import backup</label><input id="imp" type="file" accept="application/json,.json" class="sr" data-f="import">' +
      '<button class="link danger" type="button" data-act="reset">Erase data on this device</button><button class="link danger" type="button" data-act="delete-open">Delete my data from the cloud</button></div>' +
      '<p class="lab" style="margin-top:18px"><span>Privacy</span></p><p class="muted small-note">Stored: your username, workouts (date, exercise, reps, weight), body weights, measurements and your plan settings. Kept on this device and in a private-by-name cloud database so you can sign in on another phone. No email, no password, no ads, no tracking. Anyone who knows your username can open your data, so keep it private. You can export or delete everything here.</p></details>';
    return h;
  }

  /* =========================================================  REST TIMER  */
  var Rest = (function () {
    var el = document.getElementById('rest'), txt = document.getElementById('rest-t'), end = 0, tick = 0, fired = false, ctx = null, hideT = 0;
    var lastEx = '', cur = 0;
    function cfg() { try { var c = JSON.parse(localStorage.getItem('gymtracker.rest')); if (c && c.sec) { return c; } } catch (e) {} return { on: true, sec: 90 }; }
    // smart rest: big lifts get longer, small ones shorter, and a time you extend is remembered for that exercise
    var BIG = /bench|squat|deadlift|row|press|pull-up|pulldown|lunge/;
    function smartSec(exId) {
      var ex = Data.byId[exId], over = {}; try { over = JSON.parse(localStorage.getItem('gymtracker.restx')) || {}; } catch (e) {}
      if (over[exId]) { return over[exId]; }
      if (!ex) { return 90; }
      return ex.timed ? 45 : (ex.equip === 'Barbell' || BIG.test(ex.id)) && ex.id !== 'barbell-curl' && ex.id !== 'lying-triceps-extension' && ex.id !== 'front-raise' && ex.id !== 'lateral-raise' ? 150 : 75;
    }
    function setCfg(c) { try { localStorage.setItem('gymtracker.rest', JSON.stringify(c)); } catch (e) {} }
    function beep() {
      try { [0, 0.28].forEach(function (d) { var o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 880; g.gain.value = 0.2; o.connect(g); g.connect(ctx.destination); o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + 0.16); }); } catch (e) {}
      if (navigator.vibrate) { navigator.vibrate([250, 120, 250]); }
    }
    function hide() { clearInterval(tick); el.hidden = true; el.classList.remove('over'); document.body.classList.remove('resting'); }
    function paint() {
      var left = Math.ceil((end - Date.now()) / 1000);
      if (left > 0) { txt.textContent = 'Rest ' + Math.floor(left / 60) + ':' + (left % 60 < 10 ? '0' : '') + (left % 60); return; }
      clearInterval(tick);
      if (!fired) { fired = true; if (left > -15) { beep(); } txt.textContent = 'Bell! Next round'; el.classList.add('over'); hideT = setTimeout(hide, 7000); }
    }
    function start(exId) {
      var c = cfg(); if (!c.on) { return; }
      lastEx = exId || ''; cur = c.smart !== false && exId ? smartSec(exId) : c.sec;
      try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); if (ctx.resume) { ctx.resume(); } } catch (e) {}
      clearTimeout(hideT); end = Date.now() + cur * 1000; fired = false; el.hidden = false; el.classList.remove('over'); document.body.classList.add('resting');
      clearInterval(tick); tick = setInterval(paint, 250); paint();
    }
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-rest]'); if (!b) { return; }
      if (b.dataset.rest === 'skip') { clearTimeout(hideT); hide(); } else if (!fired) { end += 15000; cur += 15; if (lastEx && cfg().smart !== false) { var o = {}; try { o = JSON.parse(localStorage.getItem('gymtracker.restx')) || {}; } catch (e2) {} o[lastEx] = cur; try { localStorage.setItem('gymtracker.restx', JSON.stringify(o)); } catch (e3) {} } paint(); }
    });
    return { start: start, hide: function () { clearTimeout(hideT); hide(); }, cfg: cfg, setCfg: setCfg };
  })();

  /* =========================================================  ACCOUNT  */
  function syncText(st) {
    st = st || Sync.status();
    switch (st.state) {
      case 'syncing': return 'Syncing...';
      case 'synced': var d = new Date(st.at); return 'Synced at ' + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes() + '.';
      case 'offline': return 'Offline. Everything is saved on this device and will sync when you are back online.';
      case 'denied': return 'The cloud refused this username, so your data is only on this device.';
      case 'error': return 'Sync problem (' + st.msg + '). It will retry.';
      default: return 'Not synced yet.';
    }
  }

  /* ---------- sign-in: form, "remember it", loading ---------- */
  var login = { step: 'form', name: '', check: null, res: '', ticker: 0, t0: 0 };
  var WORDS_A = ['iron', 'steel', 'heavy', 'chalk', 'mighty', 'rapid', 'strong', 'titan', 'granite', 'atlas', 'savage', 'raging'], WORDS_B = ['wolf', 'bear', 'bull', 'lifter', 'plate', 'barbell', 'squat', 'rack', 'grind', 'beast', 'pump', 'tiger'];
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function digits(n) { var s = ''; while (n--) { s += Math.floor(Math.random() * 10); } return s; }
  // three personal-looking names that fit the rules (3 to 20 letters, numbers, underscores) and are not guessable from a first name
  function suggestNames() {
    var out = [], tries = 0, mk = [function () { return pick(WORDS_A) + pick(WORDS_B) + digits(3); }, function () { return 'bodybuilder' + digits(3); }, function () { return 'ilove' + pick(['gym', 'lifting', 'squats', 'iron']) + digits(3); }, function () { return pick(WORDS_B) + '_' + pick(WORDS_A) + digits(2); }];
    while (out.length < 3 && tries++ < 30) { var n = mk[Math.floor(Math.random() * mk.length)](); if (n.length <= 20 && out.indexOf(n) < 0 && !Store.knownUser(n)) { out.push(n); } }
    return out;
  }
  function strength(n) {
    if (n.length < 3) { return { cls: '', txt: '' }; }
    if (n.length < 6) { return { cls: 'bad', txt: 'Easy to guess. Add more letters and a number.' }; }
    if (n.length >= 8 && /\d/.test(n) && /[a-z]/.test(n)) { return { cls: 'good', txt: 'Hard to guess. Good.' }; }
    return { cls: 'mid', txt: 'Add a number or a few more letters to make it harder to guess.' };
  }
  var FLEX = '<svg class="flex-logo" viewBox="0 0 200 80" role="img" aria-label="Gym Workout Tracker" focusable="false"><g fill="currentColor"><rect x="2" y="37" width="8" height="6" rx="3"/><rect x="10" y="24" width="10" height="32" rx="5"/><rect x="24" y="14" width="12" height="52" rx="6"/><rect x="40" y="6" width="14" height="68" rx="7"/><rect x="190" y="37" width="8" height="6" rx="3"/><rect x="180" y="24" width="10" height="32" rx="5"/><rect x="164" y="14" width="12" height="52" rx="6"/><rect x="146" y="6" width="14" height="68" rx="7"/></g><text x="103.5" y="53" text-anchor="middle" font-family="Anton,Impact,Arial Narrow,sans-serif" font-size="32" letter-spacing="7" fill="#E5202E">GYM</text></svg>';
  function viewLogin() {
    if (login.step === 'memo') { return viewMemo(); }
    if (login.step === 'loading') { return viewLoading(); }
    return FLEX + '<h1>Who is training?</h1><p class="intro">Pick a username that is personal to you and hard to guess. It is the only key to your workouts: there is no password, so anyone who types the same name can see and change your data.</p>' +
      '<form data-form="login" novalidate><div class="fld" style="margin-top:20px"><label for="un">Username</label><div class="un-wrap"><input id="un" class="text-in" type="text" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="20" required aria-describedby="un-hint un-str" value="' + esc(login.name) + '"><span class="un-count num" id="un-count" aria-live="polite">' + login.name.length + ' / 20</span></div></div>' +
      '<p class="un-hint" id="un-hint">3 to 20 characters: lowercase letters, numbers and underscores.</p><p class="un-str" id="un-str"></p>' +
      '<div class="un-sug"><span>Need an idea? Tap one:</span><div class="un-chips" id="un-chips">' + suggestNames().map(function (n) { return '<button type="button" class="chip" data-act="use-name" data-v="' + n + '">' + n + '</button>'; }).join('') + '</div><button type="button" class="link" data-act="shuffle-names">Show other ideas</button></div>' +
      '<p class="form-err" id="login-err" role="alert"></p><button class="btn primary block" type="submit">Continue</button></form>' +
      '<div class="note gold" style="margin-top:18px"><b class="t">Keep it private</b>Do not use your first name alone or something a friend could guess. Mix words and a number, like <b>ironwolf482</b>.</div>';
  }
  function viewMemo() {
    return '<a class="crumb" href="#/" data-act="memo-back">Change username</a><h1>Remember this username</h1><p class="intro">This is your key. You need it to log in on another phone or after clearing your browser data, and nobody can recover it for you. Anyone who knows it can open your workouts, so keep it private.</p>' +
      '<div class="memo-name" id="memo-name">' + esc(login.name) + '</div><div class="btns"><button class="btn small" type="button" data-act="copy-name">Copy it</button></div>' +
      '<label class="memo-ok"><input type="checkbox" id="memo-ok"> I have saved it (in my notes app, or as a screenshot)</label>' +
      '<p class="muted" id="memo-status" role="status" style="margin-top:10px"></p><p class="form-err" id="login-err" role="alert"></p>' +
      '<button class="btn primary block" type="button" data-act="memo-go" id="memo-go" disabled>Continue</button><p style="margin-top:8px"><button class="link" type="button" data-act="offline-go" id="offline-go" hidden>Continue offline instead</button></p>';
  }
  function viewLoading() {
    return FLEX + '<h1>Loading your workouts</h1><p class="intro" id="load-msg">Getting <b>' + esc(login.name) + '</b> from the cloud. This can take a few seconds on a slow connection.</p><div class="wait-bar" role="progressbar" aria-label="Loading"><i></i></div><p class="num" id="load-timer" style="margin-top:10px;font-weight:800">0 s</p><button class="link" type="button" data-act="load-skip" id="load-skip" hidden>Skip and continue (it will sync in the background)</button>';
  }
  function loginTimer(fn) { clearInterval(login.ticker); login.t0 = Date.now(); login.ticker = setInterval(function () { fn(Math.floor((Date.now() - login.t0) / 1000)); }, 1000); fn(0); }
  function loginReset() { clearInterval(login.ticker); login = { step: 'form', name: '', check: null, res: '', ticker: 0, t0: 0 }; }
  // sign in on this device, then wait (visibly) for the first copy of the cloud data so a returning user does not land on an empty app
  function finishSignIn(online) {
    Store.signIn(login.name); login.step = 'loading'; render(true);
    var done = false, finish = function () { if (done) { return; } done = true; clearInterval(login.ticker); loginReset(); location.hash = '#/'; render(); };
    loginTimer(function (s) { var t = document.getElementById('load-timer'); if (t) { t.textContent = s + ' s'; } var k = document.getElementById('load-skip'); if (k && s >= 6) { k.hidden = false; } if (s >= 20) { finish(); } });
    document.getElementById('load-skip').onclick = finish;
    if (online === false) { finish(); return; }
    Sync.run().then(finish, finish);
  }
  function updateUn(removed) {
    var n = login.name, c = document.getElementById('un-count'), h = document.getElementById('un-hint'), st = document.getElementById('un-str'), r = strength(n);
    if (c) { c.textContent = n.length + ' / 20' + (n.length >= 20 ? ' · limit reached' : ''); c.classList.toggle('limit', n.length >= 20); }
    if (h) { h.textContent = removed ? 'Only lowercase letters, numbers and underscores. That character was left out.' : '3 to 20 characters: lowercase letters, numbers and underscores.'; h.classList.toggle('limit', !!removed); }
    if (st) { st.textContent = r.txt; st.className = 'un-str ' + r.cls; }
    var e = document.getElementById('login-err'); if (e) { e.textContent = ''; }
  }
  function memoStatus(s) {
    var st = document.getElementById('memo-status'), off = document.getElementById('offline-go'), err = document.getElementById('login-err'), go = document.getElementById('memo-go');
    if (!st) { return; }
    if (login.res === '') { st.textContent = 'Checking the name with the cloud… ' + s + ' s' + (s >= 8 ? '. The connection is slow.' : ''); if (off) { off.hidden = s < 8; } }
    else if (login.res === 'ok') { st.textContent = 'Name checked. You can continue.'; if (off) { off.hidden = true; } }
    else { st.textContent = ''; if (off) { off.hidden = false; } if (err) { err.textContent = login.res === 'denied' ? 'The cloud refused that username. Go back and try another one.' : login.res === 'slow' ? 'The cloud did not answer in time.' : 'Could not reach the cloud.'; } if (go) { go.textContent = 'Try again'; } }
  }
  function startMemo(name) {
    login.name = name; login.step = 'memo'; login.res = ''; login.wait = false;
    login.check = Sync.check(name).then(function (r) { login.res = r; if (login.step !== 'memo') { return; } memoStatus(Math.floor((Date.now() - login.t0) / 1000)); if (login.wait) { memoContinue(); } });
    render(true); loginTimer(memoStatus);
  }
  function memoContinue() {
    var ok = document.getElementById('memo-ok'); if (!ok || !ok.checked) { return; }
    if (login.res === 'ok') { finishSignIn(true); return; }
    if (login.res === '') { login.wait = true; var g = document.getElementById('memo-go'); if (g) { g.disabled = true; g.textContent = 'Checking…'; } return; }
    if (login.res === 'denied') { login.step = 'form'; render(true); var e2 = document.getElementById('login-err'); if (e2) { e2.textContent = 'The cloud refused that username. Try another one.'; } return; }
    startMemo(login.name);   // offline, slow or error: try the check again
  }
  function unitChips() {
    return '<div class="modes" role="group" aria-label="Weight unit" style="margin-top:8px;grid-template-columns:repeat(2,1fr)">' + ['kg', 'lb'].map(function (u) { return '<button type="button" class="chip" data-act="unit" data-v="' + u + '" aria-pressed="' + (U() === u) + '">' + (u === 'kg' ? 'Kilograms (kg)' : 'Pounds (lb)') + '</button>'; }).join('') + '</div>';
  }
  function viewSetup() {
    return '<h1>Welcome, ' + esc(Store.user()) + '</h1><p class="intro">Two numbers to start. You can change them later in the Plan tab.</p>' +
      '<p class="lab" style="margin-top:18px"><span>Units</span></p>' + unitChips() + '<form data-form="setup" novalidate><div class="row-form" style="margin-top:12px"><div class="fld"><label for="su-now">Current weight (' + U() + ')</label><input id="su-now" class="text-in num" type="number" inputmode="decimal" step="0.1" min="20" max="900"></div>' +
      '<div class="fld"><label for="su-goal">Goal weight (' + U() + ')</label><input id="su-goal" class="text-in num" type="number" inputmode="decimal" step="0.1" min="20" max="900"></div></div>' +
      '<p class="form-err" id="setup-err" role="alert"></p><button class="btn primary block" type="submit" style="margin-top:14px">Start</button></form>';
  }

  /* =========================================================  ROUTER  */
  var views = { summary: viewSummary, today: viewToday, pick: viewPick, calendar: viewCalendar, home: viewProgress, progress: viewProgress, plan: viewPlan, m: viewWorkout };
  function route() {
    var parts = (location.hash || '#/').replace(/^#\/?/, '').split('/');
    var name = parts[0] || 'home'; if (name === 'progress') { name = 'home'; }
    return { name: views[name] ? name : 'today', arg: parts[1] || '', arg2: parts[2] || '' };
  }
  function render(keepScroll) {
    Engine.unmountAll(); if (window.Engine3D) { Engine3D.unmountAll(); }
    var r = route(), gate = (!Store.user() || login.step === 'loading') ? 'login' : Store.needsSetup() ? 'setup' : onboardWeek ? 'week' : '';
    document.body.classList.toggle('gated', !!gate); view.setAttribute('data-r', gate || r.name); clearInterval(quoteTimer);
    if (gate || r.name === 'summary') { Rest.hide(); }
    view.innerHTML = gate ? (gate === 'login' ? viewLogin() : gate === 'week' ? viewWeek() : viewSetup()) : views[r.name](r.arg, r.arg2);
    document.querySelectorAll('.tabs a').forEach(function (a) {
      var on = a.dataset.tab === (r.name === 'm' || r.name === 'pick' || r.name === 'summary' ? 'today' : r.name);
      if (on) { a.setAttribute('aria-current', 'page'); } else { a.removeAttribute('aria-current'); }
    });
    view.querySelectorAll('.muscles').forEach(function (box) { showMuscle(box, box.closest('details') ? Data.byId[box.closest('details').dataset.ex].mus.view : 'front'); });
    if (r.name === 'home') { friendsRefresh(); }
    installFab();
    startSessTick(); keepAwake(r.name === 'm'); startQuotes(); var meEl = document.getElementById('me'); if (meEl) { meEl.textContent = Store.user() || ''; }
    if (!keepScroll) { window.scrollTo(0, 0); }
    if (r.name === 'home' && r.arg) { var an = document.getElementById('sec-' + r.arg); if (an) { an.scrollIntoView(); } }
    if (r.name === 'plan' && r.arg) { var pd = document.getElementById('pd-' + r.arg); if (pd) { pd.scrollIntoView(); } }
    var title = { today: 'Today', pick: 'Choose a muscle', calendar: 'Calendar', home: 'Home', plan: 'Plan', m: r.arg && Data.MUSCLES[r.arg] ? Data.MUSCLES[r.arg].name : 'Workout', summary: 'Summary' }[r.name];
    setupStage(r);
    document.title = gate ? 'Gym Workout Tracker' : title + ' | Gym Workout Tracker';
  }
  function showMuscle(box, v) {
    box.dataset.view = v;
    var cv = box.querySelector('canvas.mmap'), dEl = box.closest('details');
    if (cv && dEl && window.Engine3D) { Engine3D.muscleMap(cv, Data.byId[dEl.dataset.ex], v); }
    box.querySelectorAll('.mtoggle button').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-mv') === v ? 'true' : 'false'); });
  }
  function refreshLogger(exId) {
    var sec = view.querySelector('section.ex[data-ex="' + exId + '"] .ex-log'), ex = Data.byId[exId];
    if (!sec) { return; }
    var act = document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute('data-act');
    sec.innerHTML = loggerHTML(ex);
    if (act === 'log') { var b = sec.querySelector('[data-act="log"]'); if (b) { b.focus({ preventScroll: true }); } }
    var s = document.getElementById('sum'); if (s) { s.textContent = summaryText(ex.muscle); }
    var ri = view.querySelector('.ri.on');   // keep the rail in step with the rounds just logged
    if (ri) { var st = exStatus(ex, Store.today()); ri.className = 'ri ' + st.cls + ' on'; ri.querySelector('small').textContent = st.txt; ri.querySelector('.rn').textContent = st.cls === 'done' ? '✓' : (Array.prototype.indexOf.call(ri.closest('ol').children, ri.parentNode) + 1); }
  }

  /* =========================================================  EVENTS  */
  function num(v) { var n = parseFloat(v); return isNaN(n) ? NaN : n; }
  function closeMenus() { view.querySelectorAll('.lb-menu').forEach(function (m) { m.hidden = true; }); view.querySelectorAll('[data-act="menu"]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); }); }

  document.addEventListener('click', function (e) {   // on the document so buttons inside dialogs (outside the page area) work too
    var el = e.target.closest('[data-act],[data-mv]');
    if (!el) { closeMenus(); return; }
    if (!view.contains(el) && !el.closest('#sheet') && el.id !== 'install-fab') { return; }
    if (el.dataset.mv) { showMuscle(el.closest('.muscles'), el.dataset.mv); return; }
    var act = el.dataset.act, secEl = el.closest('section.ex'), exId = secEl && secEl.dataset.ex, dr = exId && draft[exId];
    if (act !== 'menu' && act !== 'kgset') { closeMenus(); }
    switch (act) {
      case 'rep+': case 'rep-': dr.reps = Math.max(1, (num(dr.reps) || 0) + (act === 'rep+' ? 1 : -1)); refreshField(exId); break;
      case 'kg+': case 'kg-': dr.kg = Math.max(0, Stats.fromU(Math.round((Stats.toU(num(dr.kg) || 0) + (act === 'kg+' ? 1 : -1) * (U() === 'lb' ? 1 : 0.5)) * 10) / 10)); refreshField(exId); break;
      case 'kgset': dr.kg = num(el.dataset.v); closeMenus(); refreshField(exId); break;
      case 'stype': dr.t = el.dataset.v; refreshLogger(exId); break;
      case 'menu':
        var menu = secEl.querySelector('.lb-menu'), open = menu.hidden;
        closeMenus(); menu.hidden = !open; el.setAttribute('aria-expanded', String(open));
        if (open) { var sel = menu.querySelector('[aria-selected="true"]') || menu.firstElementChild; menu.focus({ preventScroll: true }); if (sel) { sel.scrollIntoView({ block: 'nearest' }); } }
        break;
      case 'log':
        var wasLast = Store.lastSession(exId, Store.today());
        var reps = num(dr.reps), kg = num(dr.kg), ex = Data.byId[exId];
        if (!(reps >= 1) || Math.floor(reps) !== reps) { toast('Enter the reps first'); break; }
        if (isNaN(kg) || kg < 0 || (kg === 0 && ex.equip !== 'Bodyweight')) { toast(ex.equip === 'Barbell' ? 'Pick a weight first. An empty bar is ' + BAR_NAME() + '.' : 'Pick a weight first. Start light.'); break; }
        var st = dr.t || '', newId = Store.addSet(Store.today(), ex.muscle, exId, reps, kg); if (st) { Store.setType(newId, st); }
        var allSets = Store.setsFor(Store.today(), exId), doneSets = allSets.filter(function (x) { return x.t !== 'w'; }), mine = allSets[allSets.length - 1], pr = st === 'w' ? null : Stats.prFor(mine, exLogs(exId));
        if (st === 'w') { draft[exId] = { reps: reps, kg: kg }; refreshLogger(exId); toast('Warm-up logged. Not counted in records.'); break; }
        toast('Round ' + doneSets.length + ' logged' + (pr ? '. ' + Stats.PR_TEXT[pr] + '!' : ''), pr ? { label: 'Share PR', fn: function () { openShare(prShare(exId, mine.id)); } } : null);
        if (wasLast && wasLast.sets[doneSets.length]) { draft[exId] = { reps: wasLast.sets[doneSets.length].reps, kg: wasLast.sets[doneSets.length].kg }; } // preload the next set from last time
        var ord = visibleEx(ex.muscle), oi = ord.map(function (e) { return e.id; }).indexOf(exId);
        if (!(ord[oi + 1] && Store.isSuper(ord[oi + 1].id))) { Rest.start(exId); }   // superset: go straight to the next exercise
        refreshLogger(exId);
        if (doneSets.length === ex.sets) { toast('Exercise done. Tap Next when you are ready.'); var nb = view.querySelector('[data-act="wk-next"]'); if (nb) { nb.classList.add('ready'); } }
        break;
      case 'repeat':
        var lt = Store.lastSession(exId, Store.today()), have = Store.workSets(Store.today(), exId).length, exr = Data.byId[exId], added = 0;
        if (lt) { lt.sets.slice(have).forEach(function (st) { Store.addSet(Store.today(), exr.muscle, exId, st.reps, st.kg); added++; }); }
        toast(added + (added === 1 ? ' set' : ' sets') + ' logged like last time. Remove any that differ.'); refreshLogger(exId); break;
      case 'req-send': case 'req-copy':
        var rt = document.getElementById('rq-t').value, rx = document.getElementById('rq-x').value.trim();
        if (!rx) { toast('Write a few words first'); break; }
        var rbody = rx + '\n\n---\nApp ' + APP_VERSION + ' · ' + deviceInfo();
        if (act === 'req-send') { window.open('https://github.com/umar8092/gym-tracker/issues/new?title=' + encodeURIComponent(rt + ': ' + rx.slice(0, 60)) + '&body=' + encodeURIComponent(rbody), '_blank', 'noopener'); }
        else if (navigator.clipboard) { navigator.clipboard.writeText(rt + ': ' + rbody).then(function () { toast('Copied'); }, function () { toast('Could not copy'); }); }
        break;
      case 'quote': nextQuote(); startQuotes(); break;
      case 'csv': exportCSV(el.dataset.k); toast('Spreadsheet saved'); break;
      case 'ics': var rt2 = (document.getElementById('rm-t') || {}).value || '18:00'; try { localStorage.setItem('gymtracker.remind', rt2); } catch (err) {} if (!Object.keys(Store.schedule()).length) { toast('Set your training days first'); break; } download('gym-workout-reminders.ics', icsFile(rt2), 'text/calendar;charset=utf-8'); toast('Open the file to add the reminders'); break;
      case 'delete-open': deleteSheet(); break;
      case 'delete-go':
        var dn = (document.getElementById('del-n').value || '').trim().toLowerCase(), derr = document.getElementById('del-err');
        if (dn !== Store.user()) { derr.textContent = 'That is not your username. Type it exactly to confirm.'; break; }
        el.disabled = true; el.textContent = 'Deleting…'; derr.textContent = '';
        Sync.deleteAll(Store.user()).then(function () { Store.reset(); Store.signOut(); loginReset(); draft = {}; calState = null; closeSheet(true); location.hash = '#/'; render(); toast('All your data was deleted'); }, function (e2) { el.disabled = false; el.textContent = 'Delete everything'; derr.textContent = 'Could not reach the cloud (' + e2.message + '). Nothing was deleted. Try again when you are online.'; }); break;
      case 'prog-go': progSel = el.dataset.id; location.hash = '#/home/progress'; render(); break;
      case 'awake': var aw = el.getAttribute('aria-checked') !== 'true'; try { localStorage.setItem('gymtracker.awake', aw ? 'on' : 'off'); } catch (err) {} el.setAttribute('aria-checked', String(aw)); break;
      case 'unit': try { localStorage.setItem('gymtracker.unit', el.dataset.v); } catch (err) {} Stats.setUnit(el.dataset.v); draft = {}; render(true); break;
      case 'mv-up': case 'mv-down':
        var mvEx = Data.byId[el.dataset.id], nj = moveEx(mvEx.muscle, mvEx.id, act === 'mv-up' ? -1 : 1);
        if (nj >= 0) { location.hash = '#/m/' + mvEx.muscle + '/' + (nj + 1); toast('Moved to position ' + (nj + 1)); } else { toast(act === 'mv-up' ? 'Already first' : 'Already last'); } break;
      case 'swap-open': swapSheet(Data.byId[el.dataset.id].muscle, el.dataset.id); break;
      case 'swap-go':
        var sm = Data.byId[el.dataset.id].muscle, sids = visibleEx(sm).map(function (e) { return e.id; }), sp = sids.indexOf(el.dataset.id);
        var tp = sids.indexOf(el.dataset.to);
        if (tp >= 0) { sids[tp] = el.dataset.id; } else { Store.setHidden(el.dataset.id, true); Store.setHidden(el.dataset.to, false); }
        sids[sp] = el.dataset.to; Store.setOrder(sm, sids);
        closeSheet(); location.hash = '#/m/' + sm + '/' + (sp + 1); render(true); toast('Swapped to ' + Data.byId[el.dataset.to].name); break;
      case 'wk-skip':
        var sks = skipped(); if (sks.indexOf(el.dataset.id) < 0) { sks.push(el.dataset.id); setSkipped(sks); }
        toast('Skipped. You can come back to it from the list.'); location.hash = el.dataset.to ? '#/m/' + el.dataset.to : '#/summary/' + (Data.byId[el.dataset.id] || {}).muscle; break;
      case 'sched-chip':
        var sch = Store.schedule(), dd = +el.dataset.d, list = (sch[dd] || []).slice(), at = list.indexOf(el.dataset.m);
        if (at >= 0) { list.splice(at, 1); } else if (list.length >= 3) { toast('Three muscles is the most for one day'); break; } else { list.push(el.dataset.m); }
        if (list.length) { sch[dd] = list; } else { delete sch[dd]; }
        Store.setSchedule(sch); document.getElementById('sched').outerHTML = scheduleHTML(); break;
      case 'sched-preset':
        var pr = Data.PRESETS.filter(function (x) { return x.id === el.dataset.id; })[0]; if (pr) { Store.setSchedule(pr.map); document.getElementById('sched').outerHTML = scheduleHTML(); toast('Week set: ' + pr.name); } break;
      case 'equip':
        var on = el.getAttribute('aria-pressed') === 'true'; Data.EX.forEach(function (e) { if (!e.custom && e.equip === el.dataset.k) { Store.setHidden(e.id, on); } });
        el.setAttribute('aria-pressed', String(!on)); break;
      case 'week-done': onboardWeek = false; weekOpen = false; location.hash = '#/'; render(); break;
      case 'week-open': weekOpen = true; render(); break;
      case 'week-reset': Store.setSchedule(Data.DEFAULT_SCHEDULE); Data.EX.forEach(function (e) { if (!e.custom) { Store.setHidden(e.id, false); } }); weekOpen = false; render(); break;
      case 'use-name': var ui = document.getElementById('un'); ui.value = el.dataset.v; login.name = el.dataset.v; updateUn(false); ui.focus(); break;
      case 'shuffle-names': document.getElementById('un-chips').innerHTML = suggestNames().map(function (n) { return '<button type="button" class="chip" data-act="use-name" data-v="' + n + '">' + n + '</button>'; }).join(''); break;
      case 'memo-back': loginReset(); render(true); break;
      case 'copy-name': if (navigator.clipboard) { navigator.clipboard.writeText(login.name || Store.user()).then(function () { toast('Username copied'); }, function () { toast('Could not copy'); }); } break;
      case 'memo-go': memoContinue(); break;
      case 'offline-go': finishSignIn(false); break;
      case 'retry3d': var ldr = el.closest('.load3d'); if (ldr && ldr.__retry) { ldr.__retry(); } break;
      case 'share-week': openShare(weekShare()); break;
      case 'share-workout': openShare(workoutShare(el.dataset.m)); break;
      case 'share-go': doShare('go'); break;
      case 'share-fmt': if (shareCurrent) { openShare(shareCurrent.d, el.dataset.v); } break;
      case 'share-pr': openShare(prShare(el.dataset.e, el.dataset.id)); break;
      case 'share-save': doShare('save'); break;
      case 'share-copy': doShare('copy'); break;
      case 'sheet-close': closeSheet(); break;
      case 'install': case 'install-open': installSheet(); break;
      case 'install-now':
        if (window.__installEvt) { var ie = window.__installEvt; ie.prompt(); ie.userChoice.then(function (c) { if (c && c.outcome === 'accepted') { closeSheet(true); } window.__installEvt = null; installFab(); }); } break;
      case 'install-later': try { localStorage.setItem('gymtracker.install.no', String(Date.now())); } catch (err) {} closeSheet(); if (route().name === 'home') { render(true); } break;
      case 'lib-pick':
        var hit = libHits[+el.dataset.i]; if (!hit) { break; }
        document.getElementById('cx-n').value = hit.name;
        document.getElementById('cx-m').value = LIB_MUSCLE[(hit.primaryMuscles || [])[0]] || 'arms';
        document.getElementById('cx-e').value = LIB_EQUIP[hit.equipment] || 'Dumbbells';
        document.getElementById('cx-res').innerHTML = '<p class="muted">Filled in below. Check the muscle and equipment, then Add.</p>'; break;
      case 'friend-open':
        var fno = el.dataset.n, had = !!fcache()[fno]; friendSheet(fno);
        friendLoad(fno).then(function () { if (document.getElementById('sheet')) { closeSheet(true); friendSheet(fno); } var sec = document.getElementById('sec-friends'); if (sec) { sec.outerHTML = friendsSection(); } },
          function () { var l = document.getElementById('fs-load'); if (l) { l.textContent = 'Could not load. Check the username and your connection.'; } else { toast('Could not refresh. Showing what was saved.'); } }); break;
      case 'friend-refresh':
        var fnr = el.dataset.n; el.textContent = 'Refreshing…'; friendLoad(fnr, true).then(function () { closeSheet(true); friendSheet(fnr); var sec = document.getElementById('sec-friends'); if (sec) { sec.outerHTML = friendsSection(); } }, function () { toast('Could not refresh'); el.textContent = 'Refresh'; }); break;
      case 'friend-del':
        saveFriends(friendList().filter(function (n) { return n !== el.dataset.n; })); closeSheet(); render(true); toast('Friend removed'); break;
      case 'warm':
        var wp = secEl.querySelector(".warmup"); wp.hidden = !wp.hidden;
        if (!wp.hidden) {
          var wk = Stats.fromU(num(dr_kg(secEl))), ramp = Stats.warmup(wk);
          wp.innerHTML = ramp.length ? '<p class="pl-text"><b>Warm-up for ' + wStr(wk) + ' ' + U() + ':</b> ' + ramp.map(function (r) { return r.reps + ' × ' + wStr(r.kg) + ' ' + U() + ''; }).join(', ') + '. Rest about 60 seconds between them, then start your working sets. Warm-ups are not logged.</p>' : '<p class="pl-text">Set the kg for your first working set above and the warm-up ramp appears here. Too light to need one under 10 kg.</p>';
        } break;
      case 'set-save':
        var rowEl = el.closest('li'), nr = num(rowEl.querySelector('[data-f="er"]').value), nk = Stats.fromU(num(rowEl.querySelector('[data-f="ek"]').value));
        if (!(nr >= 1 && nr <= 100) || !(nk >= 0 && nk <= 500)) { toast('Reps 1 to 100, kg 0 to 500'); break; }
        Store.updateSet(el.dataset.id, nr, nk); toast('Round updated'); render(true); break;
      case 'set-del':
        var did = el.dataset.id; Store.removeSet(did); render(true); toast('Round deleted', { label: 'Undo', fn: function () { Store.restoreSet(did); render(true); } }); break;
      case 'plates':
        var panel = secEl.querySelector('.plates'); panel.hidden = !panel.hidden; if (!panel.hidden) { panel.innerHTML = platesHTML(exId); } break;
      case 'bar':
        barKg = num(el.dataset.v); try { localStorage.setItem('gymtracker.bar', String(barKg)); } catch (err) {}
        el.closest('.plates').innerHTML = platesHTML(exId); break;
      case 'mode': progMode = el.dataset.v === 'session' ? 'session' : +el.dataset.v; render(true); break;
      case 'rest-on': var c1 = Rest.cfg(); c1.on = !c1.on; Rest.setCfg(c1); el.setAttribute('aria-checked', String(c1.on)); break;
      case 'rest-sec':
        var c2 = Rest.cfg(); if (el.dataset.v === 'smart') { c2.smart = true; } else { c2.smart = false; c2.sec = num(el.dataset.v); } Rest.setCfg(c2);
        el.parentNode.querySelectorAll('.chip').forEach(function (b) { b.setAttribute('aria-pressed', String(b === el)); }); break;
      case 'copy-summary':
        if (navigator.clipboard) { navigator.clipboard.writeText(summaryText_).then(function () { toast('Summary copied'); }, function () { toast('Could not copy'); }); } else { toast('Copy is not available here'); }
        break;
      case 'del-custom':
        if (window.confirm('Delete this exercise? Sets you already logged stay in your history.')) { Store.removeCustom(el.dataset.id); toast('Exercise deleted'); render(true); } break;
      case 'rm':
        var rid = el.dataset.id; Store.removeSet(rid); refreshLogger(exId); toast('Round removed', { label: 'Undo', fn: function () { Store.restoreSet(rid); refreshLogger(exId); } }); break;
      case 'finish': toast('Workout saved'); break;
      case 'day': calState.sel = el.dataset.d; render(true); break;
      case 'cal-prev': case 'cal-next':
        calState.m += act === 'cal-next' ? 1 : -1;
        if (calState.m < 0) { calState.m = 11; calState.y--; } else if (calState.m > 11) { calState.m = 0; calState.y++; }
        render(true); break;
      case 'save-goal':
        var sk = num(document.getElementById('sk').value), gk = num(document.getElementById('gk').value);
        sk = Stats.fromU(sk); gk = Stats.fromU(gk); if (!(sk > 20) || !(gk > 20)) { toast('Enter both weights in ' + U()); break; }
        Store.setProfile({ startKg: sk, goalKg: gk }); toast('Goal saved'); break;
      case 'theme':
        var dark = !isDark(); document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light'); Store.setTheme(dark ? 'dark' : 'light');
        el.setAttribute('aria-checked', String(dark)); Engine.redraw(); if (window.Engine3D) { Engine3D.redraw(); } break;
      case 'export':
        var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([Store.exportJSON()], { type: 'application/json' }));
        a.download = 'gym-tracker-' + Store.today() + '.json'; a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000); break;
      case 'reset':
        if (window.confirm('Erase all workouts and weights on this device? Your cloud copy comes back at the next sync.')) { Store.reset(); draft = {}; calState = null; render(); Sync.run().then(function () { render(); }); }
        break;
      case 'sync-now': Sync.run(); break;
      case 'switch-user': Store.signOut(); loginReset(); draft = {}; calState = null; location.hash = '#/'; render(); break;
    }
  });

  function refreshField(exId) {
    var dr = draft[exId], sec = view.querySelector('section.ex[data-ex="' + exId + '"]');
    sec.querySelector('[data-f="reps"]').value = dr.reps;
    sec.querySelector('[data-f="kg"]').value = wStr(dr.kg);
    sec.querySelectorAll('.chip[data-act="kgset"]').forEach(function (c) { c.setAttribute('aria-pressed', String(num(c.dataset.v) === dr.kg)); });
    sec.querySelectorAll('.lb-menu li').forEach(function (c) { c.setAttribute('aria-selected', String(num(c.dataset.v) === dr.kg)); });
    var pl = sec.querySelector('.plates'); if (pl && !pl.hidden) { pl.innerHTML = platesHTML(exId); }
  }

  view.addEventListener('input', function (e) {
    if (e.target.id === 'un') { var raw = e.target.value, clean = raw.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20); e.target.value = clean; login.name = clean; updateUn(raw.length > clean.length && raw.toLowerCase().replace(/[^a-z0-9_]/g, '').length < raw.length); return; }
    if (e.target.dataset && e.target.dataset.f === 'lib') { clearTimeout(libTimer); var qv = e.target.value; libTimer = setTimeout(function () { libSearch(qv); }, 350); return; }
    var f = e.target.dataset.f, secEl = e.target.closest('section.ex');
    if ((f === 'reps' || f === 'kg') && secEl) {
      var dr = draft[secEl.dataset.ex]; dr[f] = e.target.value === '' ? NaN : (f === 'kg' ? Stats.fromU(num(e.target.value)) : num(e.target.value));
      secEl.querySelectorAll('.chip[data-v]').forEach(function (c) { c.setAttribute('aria-pressed', String(num(c.dataset.v) === dr.kg)); });
    }
  });
  view.addEventListener('change', function (e) {
    if (e.target.id === 'memo-ok') { var mg = document.getElementById('memo-go'); if (mg && !login.wait) { mg.disabled = !e.target.checked; } return; }
    var f = e.target.dataset.f;
    if (f === 'note') { Store.setNote(e.target.dataset.ex, e.target.value); var ne = view.querySelector('[data-note-for="' + e.target.dataset.ex + '"]'); if (ne) { var nt = Store.note(e.target.dataset.ex); ne.textContent = 'Note: ' + nt; ne.hidden = !nt; } return; }
    if (f === 'prog') { progSel = e.target.value; render(true); }
    else if (f === 'super') { Store.setSuper(e.target.dataset.id, e.target.checked); }
    else if (f === 'inc') { Store.setHidden(e.target.dataset.id, !e.target.checked); e.target.closest('.plan-ex').classList.toggle('off', !e.target.checked); }
    else if (f === 'import' && e.target.files[0]) {
      var rd = new FileReader();
      rd.onload = function () { try { Store.importJSON(String(rd.result)); draft = {}; calState = null; toast('Backup imported'); render(); } catch (err) { toast('That file is not a valid backup'); } };
      rd.readAsText(e.target.files[0]);
    }
  });
  view.addEventListener('submit', function (e) {
    var f = e.target.dataset.form;
    if (f === 'login') {
      e.preventDefault();
      var name = document.getElementById('un').value.trim().toLowerCase(), err = document.getElementById('login-err');
      err.textContent = '';
      if (!/^[a-z0-9_]{3,20}$/.test(name)) { err.textContent = 'Use 3 to 20 lowercase letters, numbers or underscores.'; return; }
      if (Store.knownUser(name)) { Store.signIn(name); loginReset(); location.hash = '#/'; render(); Sync.run().then(function () { render(true); }); return; }   // already on this device: open at once, sync in the background
      startMemo(name);
    } else if (f === 'setup') {
      e.preventDefault();
      var now = Stats.fromU(num(document.getElementById('su-now').value)), goal = Stats.fromU(num(document.getElementById('su-goal').value));
      if (!(now >= 20 && now <= 400) || !(goal >= 20 && goal <= 400)) { document.getElementById('setup-err').textContent = 'Enter both weights in ' + U() + '.'; return; }
      Store.setProfile({ startKg: now, goalKg: goal }); Store.addWeight(Store.today(), now); onboardWeek = true; location.hash = '#/'; render();
    } else if (f === 'measure') {
      var md = document.getElementById('ms-d').value, mv = { d: md };
      ['waist', 'chest', 'arm'].forEach(function (k) { var v = parseFloat(document.getElementById('ms-' + k).value); if (v >= 10 && v <= 250) { mv[k] = Math.round(v * 10) / 10; } });
      if (!md || (!mv.waist && !mv.chest && !mv.arm)) { toast('Enter a date and at least one measurement in cm'); return; }
      Store.addMeasure(mv); toast('Measurements saved'); render(true);
    } else if (f === 'friend') {
      var nm = document.getElementById('fr-n').value.trim().toLowerCase();
      if (!/^[a-z0-9_]{3,20}$/.test(nm)) { toast('Usernames are 3 to 20 letters, numbers or underscores'); return; }
      if (nm === Store.user()) { toast('That is you'); return; }
      var fl = friendList(); if (fl.indexOf(nm) < 0) { fl.push(nm); saveFriends(fl.slice(0, 5)); } render(true);
    } else if (f === 'custom') {
      var cn = document.getElementById('cx-n').value.trim(), cs = parseInt(document.getElementById('cx-s').value, 10), cr = document.getElementById('cx-r').value.trim();
      if (!cn || !(cs >= 1 && cs <= 10) || !/^\d{1,2}(-\d{1,2})?$/.test(cr)) { toast('Give it a name, 1 to 10 sets and reps like 10 or 8-12'); return; }
      var ceq = document.getElementById('cx-e').value;
      if (!Store.addCustom({ name: cn, muscle: document.getElementById('cx-m').value, equip: ceq === 'Timed' ? 'Bodyweight' : ceq, timed: ceq === 'Timed', sets: cs, reps: cr })) { toast('You can add up to 12 own exercises'); return; }
      toast('Exercise added'); render(true);
    } else if (f === 'weight') {
      e.preventDefault();
      var d = document.getElementById('wd').value, kg = Stats.fromU(num(document.getElementById('wk').value));
      if (!d || !(kg >= 20 && kg <= 400)) { toast('Enter a date and a weight in ' + U()); return; }
      Store.addWeight(d, kg); toast('Weight saved'); render(true);
    }
  });
  view.addEventListener('keydown', function (e) {
    var menu = e.target.closest && e.target.closest('.lb-menu');
    if (!menu) { return; }
    var items = [].slice.call(menu.children), cur = menu.querySelector('.kb') || menu.querySelector('[aria-selected="true"]') || items[0], i = items.indexOf(cur);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      i = Math.max(0, Math.min(items.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)));
      items.forEach(function (x) { x.classList.remove('kb'); x.style.outline = ''; }); items[i].classList.add('kb'); items[i].style.outline = '3px solid var(--accent)'; items[i].scrollIntoView({ block: 'nearest' }); e.preventDefault();
    } else if (e.key === 'Enter' || e.key === ' ') { cur.click(); e.preventDefault(); }
    else if (e.key === 'Escape') { closeMenus(); var b = menu.closest('.kg-row').querySelector('[data-act="menu"]'); b.focus(); }
  });
  // open a form guide: start its 3D figure the first time
  view.addEventListener('toggle', function (e) {
    var d = e.target;
    if (!d.matches || !d.matches('details.guide') || !d.open) { return; }
    var ex = Data.byId[d.dataset.ex], fig = d.querySelector('.fig'), mbox = d.querySelector('.muscles'), host = d.querySelector('.g-fig');
    if (!ex || ex.custom || !fig || fig.__st) { return; }
    var ld = null, retry = function () { open3D(); };
    function open3D() {
      if (ld && ld.parentNode) { ld.parentNode.removeChild(ld); }
      if (!window.Engine3D && host) { host.insertAdjacentHTML('afterbegin', loaderHTML()); ld = host.querySelector('.load3d'); }
      load3D(function (f) { setLoader(ld, f); }).then(function () {
        if (!fig.__st) {
          if (Engine3D.supports(ex)) { Engine3D.mount(fig, ex); }
          else { fig.querySelector('.phase').textContent = '3D needs a newer browser or phone. The steps below still apply.'; }
        }
        if (mbox && ex.mus) { showMuscle(mbox, mbox.dataset.view || ex.mus.view); }
        var tries = 0, wait = setInterval(function () { if ((fig.__st && fig.__st.ready) || ++tries > 150) { clearInterval(wait); if (ld && ld.parentNode) { ld.parentNode.removeChild(ld); } } }, 100);
      }, function () {
        if (ld) { ld.innerHTML = '<b class="pct">!</b><span>Could not load the 3D figure</span><small>Check your connection.</small><button class="btn small" type="button" data-act="retry3d">Try again</button>'; ld.__retry = retry; }
      });
    }
    open3D();
  }, true);
  window.addEventListener('hashchange', function () { render(); });
  document.addEventListener('click', function (e) { if (!e.target.closest('.kg-row')) { closeMenus(); } });

  Store.onMerge(function () { if (Store.user() && route().name !== 'm') { render(true); } });
  Sync.onStatus(function (st) {
    ['sync-line', 'sync-state'].forEach(function (id) { var el = document.getElementById(id); if (el) { el.textContent = syncText(st); } });
  });
  render();
  if (window.__bootDone) { window.__bootDone(); }
  if (Store.user()) { Sync.run(); }
  window.__gym = { render: render, get login() { return login; } };
})();
