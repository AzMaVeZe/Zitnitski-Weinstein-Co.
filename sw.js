/* Service worker for the ZW Tax app (tax.zw-co.com).
 *
 * Strategy: NETWORK-FIRST for everything. Tax figures must never be served
 * stale while the network is available - the cache exists only as an offline
 * fallback. This was a security-review decision; do not switch to
 * cache-first.
 *
 * Kill switch: /sw.js is served with Cache-Control: no-cache (see _headers),
 * so deploying KILL_SWITCH = true reaches every installed client on its next
 * visit, wipes the caches, and unregisters the worker.
 */
'use strict';

var KILL_SWITCH = false;

/* Bumping the version drops the old cache on activate. Not needed for
 * content freshness (network-first handles that) - bump only if the cached
 * URL set changes shape or a corrupt-cache reset is ever needed. */
var CACHE_NAME = 'zwco-app-v1';

/* Cloudflare Pages 308-redirects *.html to extensionless URLs, so the
 * extensionless form is what actually ends up cached and matched. */
var PRECACHE = [
  '/',
  '/calculator',
  '/calculator2',
  '/treaty-rates',
  '/contact',
  '/calculator.css',
  '/tax-engine.js',
  '/calculator2.sections.js',
  '/manifest.json',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  '/assets/icon-maskable-512.png',
  '/assets/zwco-logo-full.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      /* Seed one-by-one: a single failed fetch must not abort the whole
       * install - anything missed here gets picked up by runtime caching. */
      return Promise.all(PRECACHE.map(function (url) {
        return cache.add(url).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      if (KILL_SWITCH) {
        return Promise.all(keys.map(function (k) { return caches.delete(k); }))
          .then(function () { return self.registration.unregister(); });
      }
      return Promise.all(keys.filter(function (k) { return k !== CACHE_NAME; })
        .map(function (k) { return caches.delete(k); }))
        .then(function () { return self.clients.claim(); });
    })
  );
});

/* Internal links use the .html form, but the cache holds the extensionless
 * form the 308 resolves to - map one onto the other for offline matching. */
function extensionlessPath(request) {
  var path = new URL(request.url).pathname;
  if (path.slice(-11) === '/index.html') path = path.slice(0, -10);
  else if (path.slice(-5) === '.html') path = path.slice(0, -5);
  if (path === '/index') path = '/';
  return path;
}

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(request).then(function (response) {
      /* Navigations carry redirect mode "manual": the 308 for a .html URL
       * arrives as an opaqueredirect that must be passed through untouched
       * for the browser to follow - it fails every condition below, and the
       * follow-up extensionless request is what gets cached. */
      if (response && response.ok && response.type === 'basic' && !response.redirected) {
        var copy = response.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put(request, copy); });
      }
      return response;
    }).catch(function (err) {
      return caches.open(CACHE_NAME).then(function (cache) {
        return cache.match(request, { ignoreSearch: true }).then(function (hit) {
          if (hit) return hit;
          if (request.mode === 'navigate') {
            return cache.match(extensionlessPath(request), { ignoreSearch: true })
              .then(function (page) { if (page) return page; throw err; });
          }
          throw err;
        });
      });
    })
  );
});
