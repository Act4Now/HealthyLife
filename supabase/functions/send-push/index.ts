import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const cors = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'https://act4now.github.io',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors })

  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  const subject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:support@healthylife.app'
  if (!url || !anonKey || !serviceKey || !publicKey || !privateKey) {
    return Response.json({ error: 'Push server configuration is incomplete.' }, { status: 503, headers: cors })
  }

  const authorization = req.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) {
    return Response.json({ error: 'Authentication required.' }, { status: 401, headers: cors })
  }

  const authClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } })
  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Invalid session.' }, { status: 401, headers: cors })

  let body: { title?: string; message?: string; url?: string }
  try { body = await req.json() } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400, headers: cors })
  }
  const title = typeof body.title === 'string' ? body.title.slice(0, 80) : 'HealthyLife'
  const message = typeof body.message === 'string' ? body.message.slice(0, 240) : 'Ai un memento pentru obiceiurile tale sănătoase.'
  const targetUrl = typeof body.url === 'string' && body.url.startsWith('/HealthyLife/') ? body.url : '/HealthyLife/'

  const admin = createClient(url, serviceKey)
  const { data: subscriptions, error } = await admin.from('push_subscriptions')
    .select('id,endpoint,p256dh,auth').eq('user_id', user.id)
  if (error) return Response.json({ error: 'Could not load push subscriptions.' }, { status: 500, headers: cors })
  if (!subscriptions?.length) return Response.json({ sent: 0, message: 'No push subscription registered.' }, { headers: cors })

  webpush.setVapidDetails(subject, publicKey, privateKey)
  const payload = JSON.stringify({ title, body: message, url: targetUrl, tag: 'healthylife-reminder' })
  let sent = 0
  const expired: string[] = []
  const failures: string[] = []
  await Promise.all(subscriptions.map(async (subscription) => {
    try {
      await webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      }, payload)
      sent += 1
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) expired.push(subscription.id)
      else failures.push(String(status ?? 'send-error'))
    }
  }))
  if (expired.length) await admin.from('push_subscriptions').delete().in('id', expired).eq('user_id', user.id)
  return Response.json({ sent, expired: expired.length, failed: failures.length }, { headers: cors })
})
