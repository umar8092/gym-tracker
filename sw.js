/* Service worker.
   Small precache (the app shell), everything else is saved the first time it is used, so a slow connection never has to download
   the 3D files unless a form guide is opened. Strategy per file type:
   - pages, scripts, styles: network first but with a short deadline, then the saved copy (so updates arrive and a bad connection does not hang)
   - fonts, images, models, 3D libraries, icons: saved copy first (they only change when the file name or version does)
   Bump VERSION whenever any of these files change. */
var VERSION = 'gym-v20';       // code: pages, scripts, styles. Bump with every release.
var ASSETS = 'gym-assets-1';   // fonts, images, models, 3D libraries. Bump only when one of those files changes (so users do not re-download the 3D files on every release).
var SHELL = ['./', 'index.html', 'css/app.css', 'css/fonts.css', 'js/data.js', 'js/store.js', 'js/sync.js', 'js/stats.js', 'js/charts.js', 'js/machines.js', 'js/app.js',
  'fonts/Anton-400.woff2', 'fonts/Archivo-600.woff2', 'fonts/Archivo-800.woff2', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon.svg', 'icons/favicon-32.png'];
var STATIC = /\/(fonts|img|models|vendor|icons)\//;
var DEADLINE = 3500;

self.addEventListener('install', function (e) {
  var code = SHELL.filter(function (f) { return !STATIC.test('/' + f); }), assets = SHELL.filter(function (f) { return STATIC.test('/' + f); });
  e.waitUntil(Promise.all([caches.open(VERSION).then(function (c) { return c.addAll(code); }),
    caches.open(ASSETS).then(function (c) { return Promise.all(assets.map(function (f) { return c.match(f).then(function (hit) { return hit || c.add(f); }); })); })]).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    // the asset cache survives releases; old code caches (and old asset caches) go
    return Promise.all(keys.filter(function (k) { return k !== VERSION && k !== ASSETS; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function save(req, res) { if (res && res.ok) { var copy = res.clone(), name = STATIC.test(new URL(req.url).pathname) ? ASSETS : VERSION; caches.open(name).then(function (c) { c.put(req, copy); }); } return res; }
function fromCache(req) { return caches.match(req).then(function (hit) { return hit || caches.match('index.html'); }); }   // caches.match looks in every cache

self.addEventListener('fetch', function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) { return; }
  if (STATIC.test(url.pathname)) {
    e.respondWith(caches.match(req).then(function (hit) { return hit || fetch(req).then(function (res) { return save(req, res); }); }));
    return;
  }
  // network first with a deadline
  e.respondWith(new Promise(function (resolve) {
    var settled = false, timer = setTimeout(function () { caches.match(req).then(function (hit) { if (hit && !settled) { settled = true; resolve(hit); } }); }, DEADLINE);
    fetch(req).then(function (res) { clearTimeout(timer); if (!settled) { settled = true; resolve(save(req, res)); } else { save(req, res); } },
      function () { clearTimeout(timer); if (!settled) { settled = true; resolve(fromCache(req)); } });
  }));
});
