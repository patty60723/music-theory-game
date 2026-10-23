// 離線快取。改了網站內容要讓大家更新時，把 VERSION 加一。
const VERSION = 'v21';
const APP = 'app-' + VERSION;
const FONTS = 'fonts';
const PRECACHE = ['finale-player.css', 'finale-score.js', 'finale-player.js', './', 'index.html', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(APP).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== APP && k !== FONTS).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Authenticated score/PDFs and legacy source URLs must never enter offline caches.
  if (url.origin === location.origin && /\/(api\/finale|assets|private)(\/|$)/.test(url.pathname)) {
    e.respondWith(fetch(req, { cache: 'no-store' }));
    return;
  }

  // 頁面：先上網拿最新版，離線時用快取
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req, { cache: 'no-cache' })   // 跳過瀏覽器的 HTTP 快取，確保拿到剛推上去的版本
        .then(res => {
          // 只把首頁存進離線快取；preview.html 之類的測試頁不能蓋掉它
          if (/\/(index\.html)?$/.test(url.pathname) && res.ok) { const copy = res.clone(); caches.open(APP).then(c => c.put('index.html', copy)); }
          return res;
        })
        .catch(() => caches.match(req).then(hit => hit || caches.match('index.html')))
    );
    return;
  }

  // Google 字型：先用快取，背景更新
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.open(FONTS).then(c => c.match(req).then(hit => {
        const net = fetch(req).then(res => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }).catch(() => hit);
        return hit || net;
      }))
    );
    return;
  }

  // 同網域的公開程式與圖示可離線使用；練唱資料需要線上驗證。
  if (url.origin === location.origin) {
    e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
      return res;
    })));
  }
});
