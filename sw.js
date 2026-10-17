/* Network-first service worker: always try the network so updates show up, fall back to the cache when offline.
   Bump VERSION when adding files to SHELL. */
var VERSION = 'gym-v17';
var SHELL = ['./', 'index.html', 'css/app.css', 'css/fonts.css', 'js/data.js', 'js/store.js', 'js/sync.js', 'js/stats.js', 'js/charts.js', 'js/muscle.js', 'js/machines.js', 'js/engine.js', 'js/app.js', 'js/figure3d.js', 'js/fig/rig.js', 'js/fig/props.js', 'js/fig/poses.js', 'js/fig/muscles.js', 'js/fig/exercises.js', 'js/fig/exercises2.js', 'js/fig/machines3d.js', 'vendor/three.module.min.js', 'vendor/addons/loaders/GLTFLoader.js', 'vendor/addons/utils/BufferGeometryUtils.js', 'vendor/addons/utils/SkeletonUtils.js', 'vendor/addons/environments/RoomEnvironment.js', 'models/Superhero_Male_FullBody.gltf', 'models/Superhero_Male_FullBody.bin', 'models/T_Superhero_Male_Light.jpg', 'models/T_Superhero_Male_Normal.jpg', 'models/T_Superhero_Male_Roughness.jpg', 'models/T_Eye_Brown.png', 'models/T_Eye_Normal.png', 'models/T_Hair_1_BaseColor.jpg', 'models/T_Hair_1_Normal.jpg',
  'fonts/Anton-400.ttf', 'fonts/Archivo-600.ttf', 'fonts/Archivo-800.ttf', 'manifest.webmanifest', 'img/ex/arnold-press.webp', 'img/ex/barbell-bench-press.webp', 'img/ex/barbell-curl.webp', 'img/ex/barbell-row.webp', 'img/ex/barbell-squat.webp', 'img/ex/bent-over-rear-fly.webp', 'img/ex/cable-pushdown.webp', 'img/ex/close-grip-bench.webp', 'img/ex/dumbbell-calf-raise.webp', 'img/ex/dumbbell-fly.webp', 'img/ex/dumbbell-walking-lunge.webp', 'img/ex/front-raise.webp', 'img/ex/hammer-curl.webp', 'img/ex/incline-dumbbell-press.webp', 'img/ex/lat-pulldown.webp', 'img/ex/lateral-raise.webp', 'img/ex/leg-curl.webp', 'img/ex/leg-press.webp', 'img/ex/lying-triceps-extension.webp', 'img/ex/machine-chest-press.webp', 'img/ex/one-arm-dumbbell-row.webp', 'img/ex/overhead-press.webp', 'img/ex/overhead-triceps-extension.webp', 'img/ex/pull-up.webp', 'img/ex/push-up.webp', 'img/ex/romanian-deadlift.webp', 'img/ex/seated-cable-row.webp', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) { return; }
  e.respondWith(fetch(req).then(function (res) {
    var copy = res.clone();
    caches.open(VERSION).then(function (c) { c.put(req, copy); });
    return res;
  }).catch(function () { return caches.match(req).then(function (hit) { return hit || caches.match('index.html'); }); }));
});
