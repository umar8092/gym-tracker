/* Network-first service worker: always try the network so updates show up, fall back to the cache when offline.
   Bump VERSION when adding files to SHELL. */
var VERSION = 'gym-v16';
var SHELL = ['./', 'index.html', 'css/app.css', 'css/fonts.css', 'js/data.js', 'js/store.js', 'js/sync.js', 'js/stats.js', 'js/charts.js', 'js/muscle.js', 'js/machines.js', 'js/engine.js', 'js/app.js', 'js/figure3d.js', 'js/fig/rig.js', 'js/fig/props.js', 'js/fig/poses.js', 'js/fig/muscles.js', 'js/fig/exercises.js', 'js/fig/exercises2.js', 'js/fig/machines3d.js', 'vendor/three.module.min.js', 'vendor/addons/loaders/GLTFLoader.js', 'vendor/addons/utils/BufferGeometryUtils.js', 'vendor/addons/utils/SkeletonUtils.js', 'vendor/addons/environments/RoomEnvironment.js', 'models/Superhero_Male_FullBody.gltf', 'models/Superhero_Male_FullBody.bin', 'models/T_Superhero_Male_Light.jpg', 'models/T_Superhero_Male_Normal.jpg', 'models/T_Superhero_Male_Roughness.jpg', 'models/T_Eye_Brown.png', 'models/T_Eye_Normal.png', 'models/T_Hair_1_BaseColor.jpg', 'models/T_Hair_1_Normal.jpg',
  'fonts/barlow-400.woff2', 'fonts/barlow-500.woff2', 'fonts/barlowcondensed-600.woff2', 'fonts/barlowcondensed-700.woff2', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];

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
