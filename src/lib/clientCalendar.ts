export const STUDIO_ADDRESS = 'Rua Carmo Vieira, 430, Jardim Bom Jesus, Pirapora do Bom Jesus'

export interface ClientCalendarEvent {
  uid: string
  serviceName: string
  date: string // YYYY-MM-DD
  time: string // HH:MM or HH:MM:SS
  durationMinutes: number
  cancelUrl?: string
}

// Brazil has had no daylight saving time since 2019, so São Paulo is always UTC-3.
const SAO_PAULO_UTC_OFFSET_HOURS = 3

function toUtcStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function eventRange(event: ClientCalendarEvent): { start: Date; end: Date } {
  const [y, m, d] = event.date.split('-').map(Number)
  const [h, min] = event.time.split(':').map(Number)
  const start = new Date(Date.UTC(y, m - 1, d, h + SAO_PAULO_UTC_OFFSET_HOURS, min))
  const end = new Date(start.getTime() + (event.durationMinutes || 60) * 60_000)
  return { start, end }
}

function eventTitle(event: ClientCalendarEvent): string {
  return `Stay Beautiful · ${event.serviceName}`
}

function eventDescription(event: ClientCalendarEvent): string {
  let text = `Seu horário com a Joyce: ${event.serviceName}.`
  if (event.cancelUrl) text += `\n\nPrecisa cancelar ou reagendar? ${event.cancelUrl}`
  return text
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/** Folds long content lines as required by RFC 5545 (continuation lines start with a space). */
function foldIcsLine(line: string): string {
  const chars = Array.from(line)
  if (chars.length <= 73) return line
  const parts: string[] = []
  for (let i = 0; i < chars.length; i += 73) parts.push(chars.slice(i, i + 73).join(''))
  return parts.join('\r\n ')
}

export function buildIcs(events: ClientCalendarEvent[]): string {
  const now = toUtcStamp(new Date())
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Stay Beautiful//Agendamento//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]

  for (const event of events) {
    const { start, end } = eventRange(event)
    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.uid}@staybeautiful`,
      `DTSTAMP:${now}`,
      `DTSTART:${toUtcStamp(start)}`,
      `DTEND:${toUtcStamp(end)}`,
      `SUMMARY:${escapeIcsText(eventTitle(event))}`,
      `DESCRIPTION:${escapeIcsText(eventDescription(event))}`,
      `LOCATION:${escapeIcsText(STUDIO_ADDRESS)}`,
      ...(event.cancelUrl ? [`URL:${event.cancelUrl}`] : []),
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'DESCRIPTION:Lembrete: amanhã você tem horário na Stay Beautiful',
      'TRIGGER:-P1D',
      'END:VALARM',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'DESCRIPTION:Lembrete: seu horário na Stay Beautiful é daqui a 2 horas',
      'TRIGGER:-PT2H',
      'END:VALARM',
      'END:VEVENT',
    )
  }

  lines.push('END:VCALENDAR')
  return lines.map(foldIcsLine).join('\r\n')
}

export function buildGoogleCalendarUrl(event: ClientCalendarEvent): string {
  const { start, end } = eventRange(event)
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: eventTitle(event),
    dates: `${toUtcStamp(start)}/${toUtcStamp(end)}`,
    details: eventDescription(event),
    location: STUDIO_ADDRESS,
    ctz: 'America/Sao_Paulo',
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

function isIOS(): boolean {
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
}

function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent)
}

/**
 * Adds the appointment(s) to the client's phone calendar in a single tap:
 * - Android + one event → opens Google Calendar with the event pre-filled
 * - iPhone → opens the native "Add to Calendar" sheet via an .ics file
 * - Everything else (desktop, Android combos) → downloads an .ics file
 */
export function addToPhoneCalendar(events: ClientCalendarEvent[]): void {
  if (events.length === 0) return

  if (isAndroid() && events.length === 1) {
    window.open(buildGoogleCalendarUrl(events[0]), '_blank')
    return
  }

  const ics = buildIcs(events)

  if (isIOS()) {
    window.location.href = `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`
    return
  }

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'agendamento-stay-beautiful.ics'
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
