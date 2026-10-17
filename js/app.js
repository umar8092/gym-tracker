/* Gym Tracker UI: hash router + six views. Plain JS, no build step. */
(function () {
  var view = document.getElementById('view');
  var toastEl = document.getElementById('toast');
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var QUICK_KG = [2.5, 5, 7.5, 10, 12.5];
  var MENU_KG = []; for (var q = 2.5; q <= 120; q += 2.5) { MENU_KG.push(q); }

  var draft = {};            // exId -> {reps, kg}, survives re-rendering of one exercise
  var calState = null;       // {y, m, sel}
  var toastTimer = 0;

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
  function kgStr(n) { return Math.abs(n - Math.round(n)) < 0.001 ? String(Math.round(n)) : String(Math.round(n * 10) / 10); }
  function longDate(s) { var d = Store.parse(s); return DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()]; }
  function mName(id) { return Data.MUSCLES[id] ? Data.MUSCLES[id].name : id; }
  function toast(msg) {
    toastEl.textContent = msg; toastEl.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { toastEl.classList.remove('on'); }, 1800);
  }
  function weekStart(s) { var d = Store.parse(s), off = (d.getDay() + 6) % 7; return Store.addDays(s, -off); }
  function visibleEx(muscle) { return Data.exercisesFor(muscle).filter(function (e) { return !Store.isHidden(e.id); }); }

  /* =========================================================  TODAY  */
  function viewToday() {
    var t = Store.today(), info = Store.dayInfo(t), d = Store.parse(t);
    var plan = Data.planFor(d.getDay());
    var h = '<p class="date-line">' + longDate(t) + '</p><div class="today-main">';
    if (info.kind === 'done') {
      var logs = Store.logsOn(t), names = info.trained.map(mName).join(' and ');
      h += '<h1>' + esc(names) + '</h1><p class="lead">' + logs.length + ' sets logged today, ' + Math.round(Store.volume(logs)).toLocaleString() + ' kg lifted in total.</p>' +
        '<p class="done-note">Today is done. Nice work.</p>' +
        '<div class="today-actions"><a class="btn primary" href="#/m/' + info.trained[0] + '">Add more sets</a><a class="link" href="#/pick">Train another muscle</a></div>';
    } else if (plan) {
      h += '<h1>' + mName(plan) + '</h1><p class="lead">' + esc(Data.MUSCLES[plan].blurb) + ' ' + visibleEx(plan).length + ' exercises.</p>' +
        '<div class="today-actions"><a class="btn primary" href="#/m/' + plan + '">Start ' + mName(plan).toLowerCase() + '</a><a class="link" href="#/pick">Choose a different muscle</a></div>';
    } else {
      h += '<h1>Rest day</h1><p class="lead">Nothing is planned today. Recovery is part of the plan.</p>' +
        '<div class="today-actions"><a class="btn" href="#/pick">Train anyway</a></div>';
    }
    h += '</div>';

    var ws = weekStart(t), cells = '';
    for (var i = 0; i < 5; i++) {
      var ds = Store.addDays(ws, i), inf = Store.dayInfo(ds), pm = inf.planned;
      var label = inf.kind === 'done' ? 'Done' : inf.kind === 'missed' ? 'Missed' : inf.kind === 'today' ? 'Today' : '';
      var shown = inf.trained.length ? inf.trained[0] : pm;
      cells += '<a class="wd ' + inf.kind + '" href="#/calendar/' + ds + '"><span class="dn">' + DAYS[(i + 1) % 7].slice(0, 3) + '</span><span class="mn">' + mName(shown) + '</span><span class="st">' + (label || '&nbsp;') + '</span></a>';
    }
    h += '<div class="week" aria-label="This week">' + cells + '</div>';

    var all = Store.allLogs(), mo = t.slice(0, 7), days = {};
    all.forEach(function (l) { if (l.d.slice(0, 7) === mo) { days[l.d] = 1; } });
    var setsWeek = all.filter(function (l) { return l.d >= ws && l.d <= Store.addDays(ws, 6); }).length;
    h += '<div class="stats"><div><b class="num">' + Store.streak() + '</b><span>Day streak</span></div>' +
      '<div><b class="num">' + Object.keys(days).length + '</b><span>Sessions this month</span></div>' +
      '<div><b class="num">' + setsWeek + '</b><span>Sets this week</span></div></div>';

    var p = Store.profile(), cur = Store.currentKg(), total = p.startKg - p.goalKg;
    var pct = total > 0 ? Math.max(0, Math.min(1, (p.startKg - cur) / total)) : 0;
    h += '<div class="goal"><div class="goal-top"><h3>' + kgStr(cur) + ' kg now, goal ' + kgStr(p.goalKg) + ' kg</h3><a class="link" href="#/progress">Log weight</a></div>' +
      '<div class="goal-bar" role="img" aria-label="' + Math.round(pct * 100) + ' percent of the way to your goal weight"><i style="width:' + Math.round(pct * 100) + '%"></i></div>' +
      '<p class="muted" style="margin-top:8px">' + (cur > p.goalKg ? kgStr(cur - p.goalKg) + ' kg to go' : 'Goal reached') + '</p></div>';
    if (!Store.persistent) { h += '<p class="warn">This browser is not saving data (private mode or storage blocked). Export a backup from the Plan tab before you close it.</p>'; }
    return h;
  }

  /* =========================================================  PICK  */
  function viewPick() {
    var t = Store.today(), plan = Data.planFor(Store.parse(t).getDay());
    var h = '<a class="crumb" href="#/">Back to today</a><h1>Which muscle today?</h1><ul class="pick-list">';
    Data.ORDER.forEach(function (id) {
      var m = Data.MUSCLES[id];
      h += '<li><a href="#/m/' + id + '"><span><span class="nm">' + m.name + '</span><br><span class="sub">' + DAYS[m.day] + ', ' + visibleEx(id).length + ' exercises</span></span>' +
        (id === plan ? '<span class="tag">Planned today</span>' : '') + '</a></li>';
    });
    return h + '</ul>';
  }

  /* =========================================================  WORKOUT  */
  function initialDraft(ex, today) {
    var done = Store.setsFor(today, ex.id), last = Store.lastSession(ex.id, today);
    if (done.length) { var s = done[done.length - 1]; return { reps: s.reps, kg: s.kg }; }
    if (last && last.sets.length) { var ls = last.sets[Math.min(done.length, last.sets.length - 1)]; return { reps: ls.reps, kg: ls.kg }; }
    return { reps: parseInt(ex.reps, 10) || 10, kg: 0 };
  }

  function loggerHTML(ex) {
    var today = Store.today(), sets = Store.setsFor(today, ex.id), last = Store.lastSession(ex.id, today);
    var dr = draft[ex.id] || (draft[ex.id] = initialDraft(ex, today));
    var h = '';
    if (last) {
      h += '<p class="last">Last time (' + longDate(last.date).replace(/^\w+ /, '') + '): ' + last.sets.map(function (s) { return s.reps + ' × ' + kgStr(s.kg); }).join(', ') + ' kg</p>';
    }
    if (sets.length) {
      h += '<ol class="sets">' + sets.map(function (s, i) {
        return '<li><span class="sn">Set ' + (i + 1) + '</span><span class="sv num">' + s.reps + ' reps × ' + kgStr(s.kg) + ' kg</span><button class="rm" type="button" data-act="rm" data-id="' + s.id + '" aria-label="Remove set ' + (i + 1) + '">Remove</button></li>';
      }).join('') + '</ol>';
    }
    var bw = ex.equip === 'Bodyweight';
    h += '<div class="logger">' +
      '<div class="fld"><label for="r-' + ex.id + '">Reps</label><div class="stepper"><button type="button" data-act="rep-" aria-label="Fewer reps">−</button>' +
        '<input id="r-' + ex.id + '" class="num" type="number" inputmode="numeric" min="1" step="1" value="' + dr.reps + '" data-f="reps"><button type="button" data-act="rep+" aria-label="More reps">+</button></div></div>' +
      '<div class="fld"><label for="k-' + ex.id + '">Kg' + (bw ? ' (0 = bodyweight)' : '') + '</label><div class="stepper"><button type="button" data-act="kg-" aria-label="Half a kilo less">−</button>' +
        '<input id="k-' + ex.id + '" class="num" type="number" inputmode="decimal" min="0" step="0.5" value="' + kgStr(dr.kg) + '" data-f="kg"><button type="button" data-act="kg+" aria-label="Half a kilo more">+</button></div></div>' +
      '<div class="kg-row"><div class="kg-pick" role="group" aria-label="Quick weights in kilograms">' +
        QUICK_KG.map(function (v) { return '<button type="button" class="chip" data-act="kgset" data-v="' + v + '" aria-pressed="' + (dr.kg === v) + '">' + v + '</button>'; }).join('') +
        '<button type="button" class="chip more" data-act="menu" aria-haspopup="listbox" aria-expanded="false">More</button></div>' +
        '<div class="lb"><ul class="lb-menu" role="listbox" tabindex="-1" aria-label="Weight in kilograms" hidden>' +
        MENU_KG.map(function (v) { return '<li role="option" data-act="kgset" data-v="' + v + '" aria-selected="' + (dr.kg === v) + '">' + kgStr(v) + ' kg</li>'; }).join('') +
        '</ul></div></div>' +
      '<button type="button" class="btn primary block log-btn" data-act="log">Log set ' + (sets.length + 1) + '</button></div>';
    return h;
  }

  function figureHTML(ex) {
    return '<canvas class="pose" tabindex="0" role="img" aria-label="Rotatable 3D figure doing the ' + esc(ex.name) + '. Drag, or use the left and right arrow keys, to turn it."></canvas>' +
      '<p class="hint">Drag the figure to turn it all the way around.</p>' +
      '<div class="views" role="group" aria-label="Camera angle"><button type="button">Front</button><button type="button">Side</button><button type="button">Back</button><button type="button">Spin</button></div>' +
      '<div class="track" aria-hidden="true"><span>Start</span><div class="bar"><i></i></div><span>End</span></div>' +
      '<div class="seg" role="group" aria-label="' + esc(ex.name) + ' position"><button type="button">Start</button><button type="button">End</button><button type="button">Play</button></div>' +
      '<p class="phase"></p><p class="desc"></p>' +
      '<div class="legend"><span><i class="sw hot"></i>Red: muscle working</span><span><i class="sw arrow"></i>Dashed line: path of the weights</span></div>';
  }

  function guideHTML(ex) {
    return '<div class="guide-body">' + machineBlock(ex) +
      (ex.fig ? '<div class="fig" data-fig="' + ex.id + '">' + figureHTML(ex) + '</div>'
              : '<p class="fig-note">3D form animation for this exercise is coming. Use the diagram and steps below for now.</p>') +
      '<div class="muscles"><h3>Muscles worked</h3><div class="mtoggle" role="group" aria-label="Muscle diagram view"><button type="button" data-mv="front">Front</button><button type="button" data-mv="back">Back</button></div>' +
      Muscle.svg(ex) +
      '<p class="mrow"><i class="dot hot"></i><span><b>Main:</b> ' + esc(ex.mus.main) + '</span></p>' +
      '<p class="mrow"><i class="dot warm"></i><span><b>Helping:</b> ' + esc(ex.mus.help) + '</span></p></div>' +
      '<p class="step"><b>How:</b> ' + esc(ex.how) + '</p><p class="step avoid"><b>Avoid:</b> ' + esc(ex.avoid) + '</p></div>';
  }

  // what the equipment looks like, so the user can confirm the gym has it
  function machineBlock(ex) {
    return Machines.has(ex.id) ? '<div class="mach">' + Machines.svg(ex) + '<p class="look"><b>Look for:</b> ' + esc(ex.look) + '</p></div>' : '';
  }

  function viewWorkout(id) {
    var m = Data.MUSCLES[id];
    if (!m) { return '<a class="crumb" href="#/">Back to today</a><h1>Not found</h1>'; }
    var exs = visibleEx(id), t = Store.today(), planned = Data.planFor(Store.parse(t).getDay()) === id;
    var h = '<a class="crumb" href="#/">Back to today</a><h1>' + m.name + '</h1><p class="intro">' + (planned ? 'Planned for today. ' : '') + esc(m.blurb) +
      ' Rest 60 to 90 seconds between sets. Pick a weight where your last rep looks like your first.</p>';
    if (!exs.length) { h += '<p class="empty">All exercises for this muscle are switched off. Turn some on in the Plan tab.</p>'; }
    exs.forEach(function (ex, i) {
      h += '<section class="ex" data-ex="' + ex.id + '"><div class="ex-head"><span class="ex-n">' + (i + 1) + '</span><div><h2>' + esc(ex.name) + '</h2>' +
        '<p class="ex-meta"><b>' + ex.sets + ' sets of ' + esc(ex.reps) + ' reps</b>, ' + ex.equip.toLowerCase() + '. ' + esc(ex.target) + '</p>' +
        (ex.confirm ? '<p class="confirm-note">Needs confirming that your gym has it.</p>' : '') + '</div></div>' +
        '<div class="ex-log">' + loggerHTML(ex) + '</div>' +
        '<details class="guide" data-ex="' + ex.id + '"><summary>Form guide</summary>' + guideHTML(ex) + '</details></section>';
    });
    h += '<div class="finish"><h3>Finished?</h3><p class="summary" id="sum">' + summaryText(id) + '</p><div class="today-actions"><a class="btn primary" href="#/" data-act="finish">Finish workout</a></div></div>';
    h += '<p class="safety">Listen to your body. Stop an exercise if you feel sharp pain, and ask a trainer to check your form on heavy lifts.</p>';
    return h;
  }
  function summaryText(muscle) {
    var logs = Store.logsOn(Store.today()).filter(function (l) { return l.m === muscle; });
    return logs.length ? logs.length + ' sets logged, ' + Math.round(Store.volume(logs)).toLocaleString() + ' kg lifted so far.' : 'Nothing logged yet. Your sets save as you go.';
  }

  /* =========================================================  CALENDAR  */
  function viewCalendar(arg) {
    var t = Store.today();
    if (!calState) { var td = Store.parse(t); calState = { y: td.getFullYear(), m: td.getMonth(), sel: t }; }
    if (arg && /^\d{4}-\d{2}-\d{2}$/.test(arg)) { var pd = Store.parse(arg); calState = { y: pd.getFullYear(), m: pd.getMonth(), sel: arg }; }
    var y = calState.y, mo = calState.m, first = new Date(y, mo, 1), lead = (first.getDay() + 6) % 7, n = new Date(y, mo + 1, 0).getDate();
    var h = '<h1>Calendar</h1><div class="cal-head"><h2>' + MONTHS[mo] + ' ' + y + '</h2><div class="cal-nav"><button type="button" data-act="cal-prev" aria-label="Previous month">‹</button><button type="button" data-act="cal-next" aria-label="Next month">›</button></div></div>';
    h += '<div class="cal" role="grid">' + ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(function (d) { return '<div class="dow">' + d + '</div>'; }).join('');
    for (var i = 0; i < lead; i++) { h += '<div class="cd blank"></div>'; }
    var doneN = 0, planN = 0;
    for (var d = 1; d <= n; d++) {
      var ds = y + '-' + (mo + 1 < 10 ? '0' : '') + (mo + 1) + '-' + (d < 10 ? '0' : '') + d, inf = Store.dayInfo(ds);
      var shown = inf.trained.length ? inf.trained[0] : inf.planned;
      if (inf.kind === 'done' || inf.kind === 'missed') { planN += inf.planned ? 1 : 0; doneN += inf.kind === 'done' && inf.planned ? 1 : 0; }
      h += '<button type="button" class="cd ' + inf.kind + (ds === t ? ' today' : '') + '" data-act="day" data-d="' + ds + '" aria-pressed="' + (ds === calState.sel) + '" aria-label="' +
        longDate(ds) + (shown ? ', ' + mName(shown) : ', rest') + ', ' + inf.kind + '">' + d + (shown && inf.kind !== 'none' ? '<small>' + mName(shown).slice(0, 3) + '</small>' : '') + '</button>';
    }
    h += '</div><div class="cal-legend"><span><i class="lg done"></i>Trained</span><span><i class="lg missed"></i>Missed</span><span><i class="lg"></i>Planned or rest</span></div>';
    h += '<p class="muted" style="margin-top:10px">' + doneN + ' of ' + planN + ' planned days done this month so far.</p>';
    h += dayDetail(calState.sel);
    return h;
  }
  function dayDetail(ds) {
    var inf = Store.dayInfo(ds), logs = Store.logsOn(ds), t = Store.today();
    var h = '<div class="day-detail" id="detail"><h3>' + longDate(ds) + '</h3>';
    if (logs.length) {
      var byEx = {}, order = [];
      logs.sort(function (a, b) { return a.ts - b.ts; }).forEach(function (l) { if (!byEx[l.e]) { byEx[l.e] = []; order.push(l.e); } byEx[l.e].push(l); });
      h += '<p class="muted">' + logs.length + ' sets, ' + Math.round(Store.volume(logs)).toLocaleString() + ' kg lifted.</p><ul>' + order.map(function (id) {
        var ex = Data.byId[id];
        return '<li>' + esc(ex ? ex.name : id) + '<small class="num">' + byEx[id].map(function (s) { return s.reps + ' × ' + kgStr(s.kg); }).join(', ') + ' kg</small></li>';
      }).join('') + '</ul>';
    } else if (inf.kind === 'missed') { h += '<p class="muted">Planned ' + mName(inf.planned) + ', nothing logged.</p>'; }
    else if (inf.kind === 'rest') { h += '<p class="muted">Rest day.</p>'; }
    else if (inf.kind === 'upcoming') { h += '<p class="muted">Planned: ' + mName(inf.planned) + '.</p>'; }
    else if (inf.kind === 'today') { h += '<p class="muted">Planned: ' + mName(inf.planned) + '.</p><div class="today-actions"><a class="btn primary" href="#/m/' + inf.planned + '">Start</a></div>'; }
    else { h += '<p class="muted">Before you started tracking.</p>'; }
    return h + '</div>';
  }

  /* =========================================================  PROGRESS  */
  function viewProgress() {
    var t = Store.today(), p = Store.profile(), ws = Store.weights();
    var h = '<h1>Progress</h1><div class="sec"><h2>Body weight</h2><p class="sub">Goal ' + kgStr(p.goalKg) + ' kg. Weigh in at the same time of day for a clear trend.</p>';
    if (ws.length >= 2) {
      h += Charts.line(ws.map(function (w) { return { x: Store.parse(w.d).getTime() / 864e5, y: w.kg, label: longDate(w.d) + ': ' + kgStr(w.kg) + ' kg' }; }),
        { goal: p.goalKg, unit: ' kg', aria: 'Body weight over time, latest ' + kgStr(ws[ws.length - 1].kg) + ' kilograms, goal ' + kgStr(p.goalKg),
          xLabel: function (x) { var d = new Date(x * 864e5); d = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); return d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3); } });
    } else { h += '<p class="empty">Add a second weigh-in and your trend line appears here.</p>'; }
    h += '<form class="row-form" data-form="weight"><div class="fld"><label for="wd">Date</label><input id="wd" class="text-in" type="date" value="' + t + '" max="' + t + '"></div>' +
      '<div class="fld"><label for="wk">Weight (kg)</label><input id="wk" class="text-in num" type="number" inputmode="decimal" step="0.1" min="20" max="400" value="' + kgStr(Store.currentKg()) + '"></div>' +
      '<button class="btn primary" type="submit">Save</button></form></div>';

    var weeks = [], cur = weekStart(t), i;
    for (i = 7; i >= 0; i--) {
      var s = Store.addDays(cur, -7 * i), e = Store.addDays(s, 6), seen = {};
      Store.allLogs().forEach(function (l) { if (l.d >= s && l.d <= e) { seen[l.d] = 1; } });
      weeks.push({ label: Store.parse(s).getDate() + '/' + (Store.parse(s).getMonth() + 1), value: Object.keys(seen).length });
    }
    h += '<div class="sec"><h2>Workouts per week</h2><p class="sub">Days trained, last 8 weeks (week start date below each bar). Plan is 5.</p>' +
      Charts.bars(weeks, { max: 5, aria: 'Workouts per week for the last 8 weeks' }) + '</div>';

    var ids = {}; Store.allLogs().forEach(function (l) { ids[l.e] = 1; });
    var list = Data.EX.filter(function (e) { return ids[e.id]; });
    h += '<div class="sec"><h2>Exercise progress</h2>';
    if (!list.length) { h += '<p class="empty">Log a set in any workout and its chart appears here.</p></div>'; return h; }
    var sel = progSel && ids[progSel] ? progSel : list[0].id;
    h += '<div class="fld" style="margin-top:12px"><label for="pe">Exercise</label><select id="pe" class="text-in" data-f="prog">' +
      list.map(function (e) { return '<option value="' + e.id + '"' + (e.id === sel ? ' selected' : '') + '>' + esc(e.name) + '</option>'; }).join('') + '</select></div>';
    var byDay = {};
    Store.allLogs().filter(function (l) { return l.e === sel; }).forEach(function (l) { var o = byDay[l.d] || (byDay[l.d] = { max: 0, vol: 0 }); o.max = Math.max(o.max, l.kg); o.vol += l.reps * l.kg; });
    var days = Object.keys(byDay).sort();
    var xf = function (x) { var d = new Date(x * 864e5); d = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); return d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3); };
    if (days.length >= 2) {
      h += '<p class="sub" style="margin-top:14px">Heaviest set (kg)</p>' + Charts.line(days.map(function (d) { return { x: Store.parse(d).getTime() / 864e5, y: byDay[d].max, label: longDate(d) + ': ' + kgStr(byDay[d].max) + ' kg' }; }), { unit: ' kg', aria: 'Heaviest set per session', xLabel: xf });
      h += '<p class="sub" style="margin-top:14px">Total volume per session (reps × kg)</p>' + Charts.line(days.map(function (d) { return { x: Store.parse(d).getTime() / 864e5, y: Math.round(byDay[d].vol), label: longDate(d) + ': ' + Math.round(byDay[d].vol) + ' kg' }; }), { unit: '', aria: 'Total volume per session', xLabel: xf });
    } else {
      var only = byDay[days[0]];
      h += '<p class="empty">One session so far: heaviest set ' + kgStr(only.max) + ' kg, ' + Math.round(only.vol) + ' kg total volume. Train it again and the chart starts.</p>';
    }
    return h + '</div>';
  }
  var progSel = '';

  /* =========================================================  PLAN  */
  function isDark() {
    var t = document.documentElement.getAttribute('data-theme');
    return t ? t === 'dark' : !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }
  function viewPlan() {
    var p = Store.profile();
    var h = '<h1>Plan</h1><p class="intro">Monday to Friday, one muscle a day, weekends off. Barbell and dumbbell moves lead. Machine moves are marked: switch off anything your gym does not have.</p>';
    Data.ORDER.forEach(function (id) {
      var m = Data.MUSCLES[id];
      h += '<div class="plan-day"><p class="dname">' + DAYS[m.day] + '</p><h2>' + m.name + '</h2>';
      Data.exercisesFor(id).forEach(function (ex) {
        var off = Store.isHidden(ex.id);
        h += '<div class="plan-item"><div class="plan-ex' + (off ? ' off' : '') + '"><label><input type="checkbox" data-f="inc" data-id="' + ex.id + '"' + (off ? '' : ' checked') + '><span class="nm">' + esc(ex.name) + '</span></label>' +
          '<span class="tg' + (ex.confirm ? ' cf' : '') + '">' + ex.equip + (ex.confirm ? ', to confirm' : '') + '</span></div>' +
          '</div>';
      });
      h += '</div>';
    });
    h += '<div class="sec"><h2>Your goal</h2><div class="row-form"><div class="fld"><label for="sk">Starting weight (kg)</label><input id="sk" class="text-in num" type="number" inputmode="decimal" step="0.1" value="' + kgStr(p.startKg) + '"></div>' +
      '<div class="fld"><label for="gk">Goal weight (kg)</label><input id="gk" class="text-in num" type="number" inputmode="decimal" step="0.1" value="' + kgStr(p.goalKg) + '"></div>' +
      '<button class="btn primary" type="button" data-act="save-goal">Save</button></div></div>';
    h += '<div class="sec"><h2>Appearance</h2><div class="switch"><span id="dm-l">Dark mode</span><button type="button" role="switch" aria-checked="' + isDark() + '" aria-labelledby="dm-l" data-act="theme"></button></div></div>';
    h += '<div class="sec"><h2>Your data</h2><p class="sub">Saved on this device. Export a backup now and then, and to move to a new phone.</p>' +
      '<div class="btns"><button class="btn small" type="button" data-act="export">Export backup</button><label class="btn small" for="imp" style="cursor:pointer">Import backup</label><input id="imp" type="file" accept="application/json,.json" class="sr" data-f="import">' +
      '<button class="link danger" type="button" data-act="reset">Erase everything</button></div></div>';
    return h;
  }

  /* =========================================================  ROUTER  */
  var views = { today: viewToday, pick: viewPick, calendar: viewCalendar, progress: viewProgress, plan: viewPlan, m: viewWorkout };
  function route() {
    var parts = (location.hash || '#/').replace(/^#\/?/, '').split('/');
    var name = parts[0] || 'today';
    return { name: views[name] ? name : 'today', arg: parts[1] || '' };
  }
  function render(keepScroll) {
    Engine.unmountAll();
    var r = route();
    view.innerHTML = views[r.name](r.arg);
    document.querySelectorAll('.tabs a').forEach(function (a) {
      var on = a.dataset.tab === (r.name === 'm' || r.name === 'pick' ? 'today' : r.name);
      if (on) { a.setAttribute('aria-current', 'page'); } else { a.removeAttribute('aria-current'); }
    });
    view.querySelectorAll('.muscles').forEach(function (box) { showMuscle(box, box.closest('details') ? Data.byId[box.closest('details').dataset.ex].mus.view : 'front'); });
    if (!keepScroll) { window.scrollTo(0, 0); }
    var title = { today: 'Today', pick: 'Choose a muscle', calendar: 'Calendar', progress: 'Progress', plan: 'Plan', m: r.arg && Data.MUSCLES[r.arg] ? Data.MUSCLES[r.arg].name : 'Workout' }[r.name];
    document.title = title + ' | Gym Tracker';
  }
  function showMuscle(box, v) {
    box.querySelectorAll('svg.mimg g[data-view]').forEach(function (g) { g.style.display = g.getAttribute('data-view') === v ? '' : 'none'; });
    box.querySelectorAll('.mtoggle button').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-mv') === v ? 'true' : 'false'); });
  }
  function refreshLogger(exId) {
    var sec = view.querySelector('section.ex[data-ex="' + exId + '"] .ex-log'), ex = Data.byId[exId];
    if (!sec) { return; }
    var act = document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute('data-act');
    sec.innerHTML = loggerHTML(ex);
    if (act === 'log') { var b = sec.querySelector('[data-act="log"]'); if (b) { b.focus({ preventScroll: true }); } }
    var s = document.getElementById('sum'); if (s) { s.textContent = summaryText(ex.muscle); }
  }

  /* =========================================================  EVENTS  */
  function num(v) { var n = parseFloat(v); return isNaN(n) ? NaN : n; }
  function closeMenus() { view.querySelectorAll('.lb-menu').forEach(function (m) { m.hidden = true; }); view.querySelectorAll('[data-act="menu"]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); }); }

  view.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act],[data-mv]');
    if (!el) { closeMenus(); return; }
    if (el.dataset.mv) { showMuscle(el.closest('.muscles'), el.dataset.mv); return; }
    var act = el.dataset.act, secEl = el.closest('section.ex'), exId = secEl && secEl.dataset.ex, dr = exId && draft[exId];
    if (act !== 'menu' && act !== 'kgset') { closeMenus(); }
    switch (act) {
      case 'rep+': case 'rep-': dr.reps = Math.max(1, (num(dr.reps) || 0) + (act === 'rep+' ? 1 : -1)); refreshField(exId); break;
      case 'kg+': case 'kg-': dr.kg = Math.max(0, Math.round(((num(dr.kg) || 0) + (act === 'kg+' ? 0.5 : -0.5)) * 10) / 10); refreshField(exId); break;
      case 'kgset': dr.kg = num(el.dataset.v); closeMenus(); refreshField(exId); break;
      case 'menu':
        var menu = secEl.querySelector('.lb-menu'), open = menu.hidden;
        closeMenus(); menu.hidden = !open; el.setAttribute('aria-expanded', String(open));
        if (open) { var sel = menu.querySelector('[aria-selected="true"]') || menu.firstElementChild; menu.focus({ preventScroll: true }); if (sel) { sel.scrollIntoView({ block: 'nearest' }); } }
        break;
      case 'log':
        var reps = num(dr.reps), kg = num(dr.kg), ex = Data.byId[exId];
        if (!(reps >= 1) || Math.floor(reps) !== reps) { toast('Enter the reps first'); break; }
        if (isNaN(kg) || kg < 0 || (kg === 0 && ex.equip !== 'Bodyweight')) { toast('Enter the kg first'); break; }
        Store.addSet(Store.today(), ex.muscle, exId, reps, kg);
        toast('Set ' + Store.setsFor(Store.today(), exId).length + ' logged');
        refreshLogger(exId); break;
      case 'rm':
        Store.removeSet(+el.dataset.id); toast('Set removed'); refreshLogger(exId); break;
      case 'finish': toast('Workout saved'); break;
      case 'day': calState.sel = el.dataset.d; render(true); break;
      case 'cal-prev': case 'cal-next':
        calState.m += act === 'cal-next' ? 1 : -1;
        if (calState.m < 0) { calState.m = 11; calState.y--; } else if (calState.m > 11) { calState.m = 0; calState.y++; }
        render(true); break;
      case 'save-goal':
        var sk = num(document.getElementById('sk').value), gk = num(document.getElementById('gk').value);
        if (!(sk > 20) || !(gk > 20)) { toast('Enter both weights in kg'); break; }
        Store.setProfile({ startKg: sk, goalKg: gk }); toast('Goal saved'); break;
      case 'theme':
        var dark = !isDark(); document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light'); Store.setTheme(dark ? 'dark' : 'light');
        el.setAttribute('aria-checked', String(dark)); Engine.redraw(); break;
      case 'export':
        var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([Store.exportJSON()], { type: 'application/json' }));
        a.download = 'gym-tracker-' + Store.today() + '.json'; a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000); break;
      case 'reset':
        if (window.confirm('Erase all workouts and weights on this device? This cannot be undone.')) { Store.reset(); draft = {}; calState = null; toast('All data erased'); render(); }
        break;
    }
  });

  function refreshField(exId) {
    var dr = draft[exId], sec = view.querySelector('section.ex[data-ex="' + exId + '"]');
    sec.querySelector('[data-f="reps"]').value = dr.reps;
    sec.querySelector('[data-f="kg"]').value = kgStr(dr.kg);
    sec.querySelectorAll('.chip[data-v]').forEach(function (c) { c.setAttribute('aria-pressed', String(num(c.dataset.v) === dr.kg)); });
    sec.querySelectorAll('.lb-menu li').forEach(function (c) { c.setAttribute('aria-selected', String(num(c.dataset.v) === dr.kg)); });
  }

  view.addEventListener('input', function (e) {
    var f = e.target.dataset.f, secEl = e.target.closest('section.ex');
    if ((f === 'reps' || f === 'kg') && secEl) {
      var dr = draft[secEl.dataset.ex]; dr[f] = e.target.value === '' ? NaN : num(e.target.value);
      secEl.querySelectorAll('.chip[data-v]').forEach(function (c) { c.setAttribute('aria-pressed', String(num(c.dataset.v) === dr.kg)); });
    }
  });
  view.addEventListener('change', function (e) {
    var f = e.target.dataset.f;
    if (f === 'prog') { progSel = e.target.value; render(true); }
    else if (f === 'inc') { Store.setHidden(e.target.dataset.id, !e.target.checked); e.target.closest('.plan-ex').classList.toggle('off', !e.target.checked); }
    else if (f === 'import' && e.target.files[0]) {
      var rd = new FileReader();
      rd.onload = function () { try { Store.importJSON(String(rd.result)); draft = {}; calState = null; toast('Backup imported'); render(); } catch (err) { toast('That file is not a valid backup'); } };
      rd.readAsText(e.target.files[0]);
    }
  });
  view.addEventListener('submit', function (e) {
    var f = e.target.dataset.form;
    if (f === 'weight') {
      e.preventDefault();
      var d = document.getElementById('wd').value, kg = num(document.getElementById('wk').value);
      if (!d || !(kg >= 20 && kg <= 400)) { toast('Enter a date and a weight in kg'); return; }
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
    var ex = Data.byId[d.dataset.ex], fig = d.querySelector('.fig');
    if (ex && ex.fig && fig && !fig.__st) { Engine.mount(fig, ex.fig); }
  }, true);
  window.addEventListener('hashchange', function () { render(); });
  document.addEventListener('click', function (e) { if (!e.target.closest('.kg-row')) { closeMenus(); } });

  render();
  window.__gym = { render: render };
})();
