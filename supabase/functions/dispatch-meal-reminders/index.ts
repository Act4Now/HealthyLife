import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const cronSecret = Deno.env.get('PUSH_CRON_SECRET')
  const supplied = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!cronSecret || supplied !== cronSecret) return new Response('Unauthorized', { status: 401 })

  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  const subject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:support@healthylife.app'
  if (!url || !serviceKey || !publicKey || !privateKey) {
    return Response.json({ error: 'Push dispatcher configuration is incomplete.' }, { status: 503 })
  }

  const admin = createClient(url, serviceKey)
  const now = new Date().toISOString()
  const { data: plans, error } = await admin.from('meal_plans')
    .select('id,user_id,planned_for,slot_name,meal_name,snoozed_until')
    .eq('reminder_enabled', true)
    .is('eaten_at', null)
    .is('reminder_sent_at', null)
    .or(`and(snoozed_until.is.null,planned_for.lte.${now}),snoozed_until.lte.${now}`)
    .limit(100)
  if (error) return Response.json({ error: 'Could not load due meal reminders.' }, { status: 500 })

  webpush.setVapidDetails(subject, publicKey, privateKey)
  let sent = 0
  let expired = 0
  let failed = 0
  for (const plan of plans ?? []) {
    const { data: subscriptions, error: subError } = await admin.from('push_subscriptions')
      .select('id,endpoint,p256dh,auth').eq('user_id', plan.user_id)
    if (subError) { failed += 1; continue }
    if (!subscriptions?.length) continue

    let delivered = false
    for (const subscription of subscriptions) {
      try {
        await webpush.sendNotification({
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        }, JSON.stringify({
          title: `HealthyLife · ${plan.slot_name}`,
          body: `Este timpul pentru: ${plan.meal_name}`,
          url: '/HealthyLife/',
          tag: `meal-plan-${plan.id}`,
        }))
        delivered = true
        sent += 1
      } catch (sendError) {
        const status = (sendError as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) {
          await admin.from('push_subscriptions').delete().eq('id', subscription.id).eq('user_id', plan.user_id)
          expired += 1
        } else failed += 1
      }
    }
    if (delivered) {
      const { error: updateError } = await admin.from('meal_plans')
        .update({ reminder_sent_at: new Date().toISOString() }).eq('id', plan.id).is('reminder_sent_at', null)
      if (updateError) failed += 1
    }
  }
  return Response.json({ due: plans?.length ?? 0, sent, expired, failed })
})
