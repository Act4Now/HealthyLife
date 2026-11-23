const APP_BASE = '/HealthyLife/'
const CACHE_NAME = 'healthylife-shell-v2.1.0'
const PRECACHE = [APP_BASE, APP_BASE + 'manifest.webmanifest', APP_BASE + 'icon-192.png', APP_BASE + 'icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME)
    // Best effort: a failed precache must never block installing the worker.
    await Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => undefined)))
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys()
    await Promise.all(names.filter((name) => name.startsWith('healthylife-shell-') && name !== CACHE_NAME).map((name) => caches.delete(name)))
    await self.clients.claim()
  })())
})

// Offline app shell only. Requests to other origins (Supabase, Google) and non-GET requests
// are never touched, so personal data is not cached by the service worker.
self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin || !url.pathname.startsWith(APP_BASE)) return
  if (url.pathname === APP_BASE + 'sw.js') return

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request)
        const cache = await caches.open(CACHE_NAME)
        cache.put(APP_BASE, fresh.clone()).catch(() => undefined)
        return fresh
      } catch {
        const cached = await caches.match(APP_BASE)
        return cached || new Response('HealthyLife este offline.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
      }
    })())
    return
  }

  // Built files and icons: serve from cache when available, refresh in the background.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME)
    const cached = await cache.match(request)
    const network = fetch(request).then((response) => {
      if (response && response.ok) cache.put(request, response.clone()).catch(() => undefined)
      return response
    }).catch(() => undefined)
    return cached || (await network) || new Response('', { status: 504 })
  })())
})

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { body: event.data ? event.data.text() : '' }
  }

  const title = typeof payload.title === 'string' ? payload.title : 'HealthyLife'
  const options = {
    body: typeof payload.body === 'string' ? payload.body : 'Ai un memento pentru obiceiurile tale sănătoase.',
    tag: typeof payload.tag === 'string' ? payload.tag : 'healthylife-reminder',
    data: { url: typeof payload.url === 'string' ? payload.url : APP_BASE },
    renotify: false,
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const requestedUrl = event.notification.data && event.notification.data.url
  const targetUrl = new URL(
    typeof requestedUrl === 'string' && requestedUrl.startsWith(APP_BASE) ? requestedUrl : APP_BASE,
    self.location.origin,
  ).href

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of windows) {
      if (client.url.startsWith(self.location.origin + APP_BASE) && 'focus' in client) {
        await client.focus()
        if ('navigate' in client && client.url !== targetUrl) await client.navigate(targetUrl)
        return
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(targetUrl)
  })())
})
