'use strict';
// assets/station/sw.js — the phone station's service worker, served at /sw.js
// (docs/90-agent/plans/2026-10-21-station-remote-design.md §4). It caches the
// shell only — the page, its script, its two stylesheets, the manifest and the
// icon — and serves those network first, the cached copy when the station
// cannot be reached, so an installed phone draws pair-error rather than the
// browser's own error page. Nothing else is intercepted: /station/mobile.json,
// every POST, and every other route go to the network as they would without it.
var CACHE = 'fankeel-m-1';
var FILES = ['/m', '/station/mobile.js', '/station/mobile.css', '/station/station.css', '/m/manifest.webmanifest', '/m/icon.svg'];

self.addEventListener('install', function (e) {
    e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});

// An older cache of this worker's goes; anything not named fankeel-m- is not its own.
self.addEventListener('activate', function (e) {
    e.waitUntil(caches.keys().then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== CACHE && k.indexOf('fankeel-m-') === 0; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
    var req = e.request;
    if (req.method !== 'GET') return;
    var u = new URL(req.url);
    if (u.origin !== self.location.origin || FILES.indexOf(u.pathname) < 0) return;
    e.respondWith(fetch(req).then(function (res) {
        if (res.ok) {
            var copy = res.clone();
            caches.open(CACHE).then(function (c) { return c.put(u.pathname, copy); });
        }
        return res;
    }).catch(function () {
        return caches.match(u.pathname).then(function (hit) { return hit || Response.error(); });
    }));
});
