/**
 * Service Worker - Offline Fallback & Cache Manager
 * Dentelle Jaya Infinitex
 */

const CACHE_NAME = 'dji-offline-v48';

const OFFLINE_ASSETS = [
  '/favicon.ico',
  '/icons/favicon-32x32.png',
  '/icons/icon-192x192.png',
  '/',
  '/offline.html',
  '/offline-qc.html',
  '/offline/css/base.css',
  '/offline/css/components.css',
  '/offline/css/modals.css',
  '/offline/css/qc.css',
  '/offline/js/config.js',
  '/offline/js/state.js',
  '/offline/js/api.js',
  '/offline/js/downtime.js',
  '/offline/js/esp32.js',
  '/offline/js/block-mesin.js',
  '/offline/js/header-modal.js',
  '/offline/js/history.js',
  '/offline/js/machine-stop.js',
  '/offline/js/app.js',
  '/offline/js/issue-report.js',
  '/offline/js/qc-app.js'
];

// Helper: Cari aset di cache aktif saat ini atau fallback ke SEMUA cache yang ada
async function matchInAnyCache(reqOrUrl, options = { ignoreSearch: true }) {
  try {
    const urlStr = typeof reqOrUrl === 'string' ? reqOrUrl : (reqOrUrl && reqOrUrl.url);
    let pathname = '';
    if (urlStr) {
      try {
        pathname = new URL(urlStr, self.location.origin).pathname;
      } catch (e) {}
    }

    // 1. Coba di cache versi aktif saat ini
    const current = await caches.open(CACHE_NAME);
    let match = await current.match(reqOrUrl, options);
    if (match) return match;
    if (pathname) {
      match = await current.match(pathname, options);
      if (match) return match;
    }

    // 2. Coba global caches.match
    match = await caches.match(reqOrUrl, options);
    if (match) return match;
    if (pathname) {
      match = await caches.match(pathname, options);
      if (match) return match;
    }

    // 3. Fallback: Cari di SEMUA cache yang pernah terdaftar di browser
    const keys = await caches.keys();
    for (const key of keys) {
      try {
        const c = await caches.open(key);
        let m = await c.match(reqOrUrl, options);
        if (m) return m;
        if (pathname) {
          m = await c.match(pathname, options);
          if (m) return m;
        }
      } catch (eKey) {}
    }
  } catch (e) {}

  return null;
}

// Install: Simpan seluruh aset offline ke cache
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        await Promise.allSettled(
          OFFLINE_ASSETS.map(async (asset) => {
            try {
              const res = await fetch(asset, { cache: 'no-cache' });
              if (res.ok) {
                await cache.put(asset, res.clone());
                const fullUrl = new URL(asset, self.location.origin).href;
                await cache.put(fullUrl, res);
              }
            } catch (err) {
              console.warn('[SW Precache item failed]:', asset, err);
              // Fallback: Jika offline saat install, selamatkan aset dari cache versi sebelumnya
              try {
                const prev = await matchInAnyCache(asset);
                if (prev) {
                  await cache.put(asset, prev.clone());
                  const fullUrl = new URL(asset, self.location.origin).href;
                  await cache.put(fullUrl, prev);
                }
              } catch (eCopy) {}
            }
          })
        );
      } catch (err) {
        console.warn('[SW Install failed]:', err);
      }
    })()
  );
});

// Activate: Bersihkan seluruh cache versi lama
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const currentCache = await caches.open(CACHE_NAME);
        const hasOffline = await currentCache.match('/offline.html');
        // Hanya bersihkan cache lama jika cache baru sudah memiliki /offline.html
        if (hasOffline) {
          const keys = await caches.keys();
          await Promise.all(
            keys
              .filter((key) => key !== CACHE_NAME && key.startsWith('dji-offline-'))
              .map((key) => caches.delete(key))
          );
        }
      } catch (e) {
        console.warn('[SW Activate error]:', e);
      }
      await self.clients.claim();
    })()
  );
});

// Fetch: Intercept requests dengan strategi cerdas
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Jangan cegat API backend atau selain GET
  if (url.pathname.startsWith('/api/') || req.method !== 'GET') {
    return;
  }

  // 1. Navigasi Halaman (HTML Document)
  if (req.mode === 'navigate') {
    const isOfflinePortal =
      url.pathname === '/offline.html' ||
      url.pathname === '/offline-qc.html' ||
      url.pathname.endsWith('offline.html') ||
      url.pathname.endsWith('offline-qc.html');

    // KASUS A: Pengguna sengaja mengakses portal offline (/offline.html /offline-qc.html)
    if (isOfflinePortal) {
      event.respondWith(
        (async () => {
          const targetPath = url.pathname.includes('qc') ? '/offline-qc.html' : '/offline.html';

          // Saat online, utamakan network-first agar update terbaru langsung termuat
          if (navigator.onLine) {
            try {
              const netRes = await fetch(url.href, { cache: 'no-cache' });
              if (netRes && netRes.ok) {
                const c = await caches.open(CACHE_NAME);
                await c.put(targetPath, netRes.clone());
                await c.put(url.href, netRes.clone());
                return netRes;
              }
            } catch (err) {}
          }

          // Saat offline atau network gagal, gunakan cache
          const cached =
            (await matchInAnyCache(req)) ||
            (await matchInAnyCache(targetPath)) ||
            (await matchInAnyCache('/offline.html'));

          if (cached) return cached;

          return new Response(
            `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Aset Offline Belum Tersedia - DJI</title><style>body{font-family:system-ui,-apple-system,sans-serif;text-align:center;padding:50px 20px;background:#f8fafc;color:#1e293b;}h2{margin-bottom:12px;font-size:20px;color:#0f172a;}p{font-size:14px;color:#64748b;margin-bottom:24px;line-height:1.6;}button{display:inline-block;padding:12px 24px;border-radius:12px;background:#0070bc;color:#fff;font-weight:700;font-size:14px;border:none;cursor:pointer;box-shadow:0 4px 14px rgba(0,112,188,0.3);}</style></head><body><h2>Aset Form Offline Belum Terunduh</h2><p>Browser sedang berada dalam mode <b>Offline</b> sebelum sempat mengunduh file form offline.<br>Silakan kembalikan koneksi ke <b>No throttling / Online</b> di DevTools sekali, lalu muat ulang halaman ini.</p><button onclick="location.reload()">Muat Ulang Halaman &rarr;</button></body></html>`,
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        })()
      );
      return;
    }

    // KASUS B: Navigasi halaman online umum (/input, /input-meter, /qc, /dashboard, dll)
    event.respondWith(
      (async () => {
        const isOnline = navigator.onLine || url.searchParams.has('online');

        // Jika online atau membawa flag online: UTAMAKAN LANGSUNG FETCH NETWORK
        if (isOnline) {
          try {
            // Gunakan url.href langsung (bukan objek req mode: navigate) agar tidak memicu TypeError di browser
            const netRes = await fetch(url.href, { cache: 'no-cache', credentials: req.credentials });
            if (netRes && (netRes.ok || netRes.type === 'opaqueredirect' || netRes.status < 400)) {
              return netRes;
            }
          } catch (err) {
            console.warn('[SW Online Navigation Fetch Failed]:', url.href, err);
          }
        }

        // Jika jaringan benar-benar offline / server mati, fallback ke formulir offline
        const targetPath = url.pathname.includes('qc') ? '/offline-qc.html' : '/offline.html';
        const cached =
          (await matchInAnyCache(targetPath)) ||
          (await matchInAnyCache('/offline.html')) ||
          (await matchInAnyCache('/offline-qc.html'));

        if (cached) return cached;

        return new Response(
          `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Offline - DJI</title><style>body{font-family:system-ui,-apple-system,sans-serif;text-align:center;padding:50px 20px;background:#f8fafc;color:#1e293b;}h2{margin-bottom:12px;font-size:22px;color:#0f172a;}p{font-size:14px;color:#64748b;margin-bottom:24px;}a{display:inline-block;padding:12px 24px;border-radius:12px;background:#0070bc;color:#fff;font-weight:700;text-decoration:none;font-size:14px;box-shadow:0 4px 14px rgba(0,112,188,0.3);}</style></head><body><h2>Koneksi Terputus</h2><p>Perangkat Anda sedang tidak terhubung ke jaringan.</p><a href="/offline.html">Buka Form Produksi Offline &rarr;</a></body></html>`,
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      })()
    );
    return;
  }

  // 2. Aset Statis Offline (/offline/*, css, js)
  if (url.pathname.includes('/offline')) {
    event.respondWith(
      (async () => {
        // STRATEGI: Network-First saat online agar update CSS/JS terbaru langsung aktif tanpa stale cache
        if (navigator.onLine) {
          try {
            const netRes = await fetch(url.href, { cache: 'no-cache' });
            if (netRes && netRes.status === 200) {
              const clone = netRes.clone();
              const c = await caches.open(CACHE_NAME);
              await c.put(req, clone);
              await c.put(url.pathname, netRes.clone());
              return netRes;
            }
          } catch (eNet) {}
        }

        // Saat offline atau jika network gagal, gunakan cache lokal (utamakan pathname agar query string tidak merusak pencarian cache)
        const cached =
          (await matchInAnyCache(url.pathname)) ||
          (await matchInAnyCache(req)) ||
          (await matchInAnyCache(url.href));
        if (cached) return cached;

        return new Response('', { status: 404, statusText: 'Offline Asset Not Found' });
      })()
    );
    return;
  }
});
