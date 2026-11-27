/* Service Worker — офлайн-режим портала «Голоса Нижневартовска» */
const CACHE = 'golosa-nv-v2';
const ASSETS = [
  './', './index.html', './about.html', './history.html', './map.html',
  './archive.html', './team.html', './contacts.html',
  './css/style.css', './js/main.js', './data/points.js',
  './assets/hero.jpg', './assets/icon-192.png', './assets/icon-512.png',
  './manifest.webmanifest', './admin.html',
  './assets/img/city-hero.jpg', './assets/img/pier-1909.jpg', './assets/img/samotlor-1969.jpg',
  './assets/img/embankment.jpg', './assets/img/museum.jpg', './assets/img/school-first.jpg',
  './assets/img/fishermen.jpg', './assets/media/demo-interview.wav', './assets/img/family.jpg', './assets/img/gramota.jpg', './assets/img/scan-doc.jpg'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Стратегия: сначала кэш, при промахе — сеть
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).catch(() => caches.match('./index.html')))
  );
});
