const APP_BASE = '/HealthyLife/'

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
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
