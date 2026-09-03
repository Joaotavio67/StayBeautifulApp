// Supabase Edge Function: calendar-sync
//
// Creates/removes events on Joyce's Google Calendar for appointments booked
// through the site, with a popup reminder 1h before each appointment. Also
// maintains a single daily "agenda summary" event (fixed 9am reminder) that
// lists every appointment for the day — action `dailyDigest`, meant to be
// triggered once a day by a pg_cron job (see supabase/functions/calendar-sync/cron.sql).
// Auth: Google service account (JWT bearer flow), no OAuth login required.
//
// Required secrets (set via `supabase secrets set`):
//   GOOGLE_CLIENT_EMAIL     - service account client_email
//   GOOGLE_PRIVATE_KEY      - service account private_key (PEM, \n-escaped is fine)
//   GOOGLE_CALENDAR_ID      - the calendar to write to (usually Joyce's Gmail address)
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are auto-injected by Supabase.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GOOGLE_CLIENT_EMAIL = Deno.env.get('GOOGLE_CLIENT_EMAIL') ?? ''
const GOOGLE_PRIVATE_KEY = (Deno.env.get('GOOGLE_PRIVATE_KEY') ?? '').replace(/\\n/g, '\n')
const GOOGLE_CALENDAR_ID = Deno.env.get('GOOGLE_CALENDAR_ID') ?? ''

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function base64url(input: ArrayBuffer | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input)
  let str = ''
  for (const b of bytes) str += String.fromCharCode(b)
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function getAccessToken(): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const claims = {
    iss: GOOGLE_CLIENT_EMAIL,
    scope: 'https://www.googleapis.com/auth/calendar',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`

  const pemBody = GOOGLE_PRIVATE_KEY
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '')
  const binaryKey = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0))

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsigned)
  )

  const jwt = `${unsigned}.${base64url(signature)}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Google auth failed: ${JSON.stringify(data)}`)
  return data.access_token as string
}

function toRfc3339Range(date: string, time: string, durationMinutes: number) {
  const [h, m] = time.slice(0, 5).split(':').map(Number)
  const start = new Date(`${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00-03:00`)
  const end = new Date(start.getTime() + durationMinutes * 60000)
  return { startISO: start.toISOString(), endISO: end.toISOString() }
}

interface CreateBody {
  action: 'create'
  appointmentId: string
  clientName: string
  clientPhone?: string
  serviceName: string
  date: string
  time: string
  durationMinutes: number
  notes?: string
}

interface DeleteByAppointmentBody {
  action: 'deleteByAppointment'
  appointmentId: string
}

interface DeleteByComboGroupBody {
  action: 'deleteByComboGroup'
  comboGroupId: string
}

interface DailyDigestBody {
  action: 'dailyDigest'
}

type RequestBody = CreateBody | DeleteByAppointmentBody | DeleteByComboGroupBody | DailyDigestBody

/** Today's date (YYYY-MM-DD) in Joyce's timezone, regardless of the server's UTC clock. */
function todayInSaoPaulo(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

/** Deterministic Google event ID for a given day's digest — valid chars are a-v and 0-9. */
function digestEventId(dateStr: string): string {
  return `digest${dateStr.replace(/-/g, '')}`
}

async function deleteGoogleEvent(accessToken: string, eventId: string) {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(GOOGLE_CALENDAR_ID)}/events/${eventId}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } }
  )
  // 410 Gone means it was already deleted on the Google side — not an error for us.
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    console.error('[calendar-sync] delete failed', eventId, await res.text())
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  try {
    if (!GOOGLE_CLIENT_EMAIL || !GOOGLE_PRIVATE_KEY || !GOOGLE_CALENDAR_ID) {
      throw new Error('Google Calendar secrets are not configured on this function.')
    }

    const body = (await req.json()) as RequestBody
    const accessToken = await getAccessToken()

    if (body.action === 'create') {
      const { startISO, endISO } = toRfc3339Range(body.date, body.time, body.durationMinutes)

      const event = {
        summary: `${body.serviceName} — ${body.clientName}`,
        description: [
          `Cliente: ${body.clientName}`,
          body.clientPhone ? `Telefone: ${body.clientPhone}` : null,
          body.notes ? `Obs: ${body.notes}` : null,
        ].filter(Boolean).join('\n'),
        start: { dateTime: startISO, timeZone: 'America/Sao_Paulo' },
        end: { dateTime: endISO, timeZone: 'America/Sao_Paulo' },
        reminders: {
          useDefault: false,
          overrides: [{ method: 'popup', minutes: 60 }],
        },
      }

      const createRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(GOOGLE_CALENDAR_ID)}/events`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(event),
        }
      )
      const created = await createRes.json()
      if (!createRes.ok) throw new Error(`Google Calendar create failed: ${JSON.stringify(created)}`)

      await supabase.from('appointments').update({ google_event_id: created.id }).eq('id', body.appointmentId)

      return new Response(JSON.stringify({ ok: true, eventId: created.id }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    if (body.action === 'deleteByAppointment') {
      const { data: appt } = await supabase
        .from('appointments')
        .select('google_event_id')
        .eq('id', body.appointmentId)
        .single()
      if (appt?.google_event_id) await deleteGoogleEvent(accessToken, appt.google_event_id)
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    if (body.action === 'dailyDigest') {
      const today = todayInSaoPaulo()
      const eventId = digestEventId(today)

      const { data: appts } = await supabase
        .from('appointments')
        .select('appointment_time, client_name, combo_name, combo_session_index, service:services(name)')
        .eq('appointment_date', today)
        .eq('status', 'confirmed')
        .order('appointment_time', { ascending: true })

      const rows = appts ?? []

      if (rows.length === 0) {
        // Nothing booked today — remove a stale digest event if one exists (e.g. all cancelled).
        await deleteGoogleEvent(accessToken, eventId)
        return new Response(JSON.stringify({ ok: true, count: 0 }), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        })
      }

      const lines = rows.map((a: any) => {
        const time = a.appointment_time.slice(0, 5)
        const serviceName = a.combo_name
          ? `${a.combo_name} (Sessão ${a.combo_session_index}/4)`
          : a.service?.name ?? 'Serviço'
        return `${time} — ${a.client_name} — ${serviceName}`
      })

      const { startISO, endISO } = toRfc3339Range(today, '09:00', 15)
      const event = {
        id: eventId,
        summary: `📅 Agenda de hoje — ${rows.length} agendamento${rows.length > 1 ? 's' : ''}`,
        description: lines.join('\n'),
        start: { dateTime: startISO, timeZone: 'America/Sao_Paulo' },
        end: { dateTime: endISO, timeZone: 'America/Sao_Paulo' },
        reminders: {
          useDefault: false,
          overrides: [{ method: 'popup', minutes: 0 }],
        },
      }

      const eventsBaseUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(GOOGLE_CALENDAR_ID)}/events`

      // Try to update first (idempotent across multiple runs the same day); insert if it doesn't exist yet.
      const updateRes = await fetch(`${eventsBaseUrl}/${eventId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      })

      if (updateRes.status === 404 || updateRes.status === 410) {
        const insertRes = await fetch(eventsBaseUrl, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(event),
        })
        const inserted = await insertRes.json()
        if (!insertRes.ok) throw new Error(`Google Calendar digest insert failed: ${JSON.stringify(inserted)}`)
      } else if (!updateRes.ok) {
        throw new Error(`Google Calendar digest update failed: ${JSON.stringify(await updateRes.json())}`)
      }

      return new Response(JSON.stringify({ ok: true, count: rows.length }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    if (body.action === 'deleteByComboGroup') {
      const { data: appts } = await supabase
        .from('appointments')
        .select('google_event_id')
        .eq('combo_group_id', body.comboGroupId)
      for (const a of appts ?? []) {
        if (a.google_event_id) await deleteGoogleEvent(accessToken, a.google_event_id)
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[calendar-sync] error', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
})
