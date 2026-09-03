import {
  addDays,
  addMinutes,
  format,
  isAfter,
  isBefore,
  setHours,
  setMinutes,
  setSeconds,
} from 'date-fns'
import type { Appointment, BlockedSlot, Combo, Service, WorkingHours } from './supabase'

const DAY_MAP: Record<number, keyof WorkingHours> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
}

/** Returns the working day key for a given Date */
export function getDayKey(date: Date): keyof WorkingHours {
  return DAY_MAP[date.getDay()]
}

/** Whether the salon is open and not fully blocked on this date */
export function isWorkingDay(date: Date, workingHours: WorkingHours, blockedSlots: BlockedSlot[]): boolean {
  const dayKey = getDayKey(date)
  if (!workingHours[dayKey]?.enabled) return false

  const dateStr = format(date, 'yyyy-MM-dd')
  const isDayBlocked = blockedSlots.some(
    b => b.blocked_date === dateStr && !b.start_time && !b.end_time
  )
  return !isDayBlocked
}

/** Returns the date that is `count` working days after `start` (skipping closed/blocked days). */
export function addWorkingDays(start: Date, count: number, workingHours: WorkingHours, blockedSlots: BlockedSlot[]): Date {
  let d = start
  let counted = 0
  while (counted < count) {
    d = addDays(d, 1)
    if (isWorkingDay(d, workingHours, blockedSlots)) counted++
  }
  return d
}

/** Parses "HH:MM" into { h, m } */
function parseTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  return { h, m }
}

/** Returns the service_id and hydrated Service for a given combo session (0-indexed) */
export function getComboSessionService(combo: Combo, sessionIndex: number): { serviceId: string; service?: Service } {
  const ids = [combo.service_id_1, combo.service_id_2, combo.service_id_3, combo.service_id_4]
  const svcs = [combo.service1, combo.service2, combo.service3, combo.service4]
  return { serviceId: ids[sessionIndex], service: svcs[sessionIndex] }
}

/**
 * Given a date, working hours config, existing appointments and blocked slots,
 * returns an array of available slot strings "HH:MM" in 30-min increments.
 * Duration can be explicit in minutes (e.g. for a single combo session) or a Service.
 */
export function getAvailableSlots(
  date: Date,
  itemOrDuration: Service | number,
  workingHours: WorkingHours,
  appointments: Appointment[],
  blockedSlots: BlockedSlot[]
): string[] {
  const dayKey = getDayKey(date)
  const dayConfig = workingHours[dayKey]

  // Day not working
  if (!dayConfig || !dayConfig.enabled) return []

  // Check if the whole day is blocked
  const dateStr = format(date, 'yyyy-MM-dd')
  const isDayBlocked = blockedSlots.some(
    (b) => b.blocked_date === dateStr && !b.start_time && !b.end_time
  )
  if (isDayBlocked) return []

  const durationMinutes = typeof itemOrDuration === 'number'
    ? itemOrDuration
    : itemOrDuration.duration_minutes

  const { h: openH, m: openM } = parseTime(dayConfig.open)
  const { h: closeH, m: closeM } = parseTime(dayConfig.close)

  let cursor = setSeconds(setMinutes(setHours(date, openH), openM), 0)
  const closeTime = setSeconds(setMinutes(setHours(date, closeH), closeM), 0)
  const now = new Date()

  const slots: string[] = []

  while (isBefore(cursor, closeTime)) {
    const slotEnd = addMinutes(cursor, durationMinutes)

    // Slot end must fit within working hours
    if (isAfter(slotEnd, closeTime)) break

    // Don't allow past slots
    if (isBefore(cursor, now)) {
      cursor = addMinutes(cursor, 30)
      continue
    }

    const slotStr = format(cursor, 'HH:mm')

    // Check slot-level blocks
    const isSlotBlocked = blockedSlots.some((b) => {
      if (b.blocked_date !== dateStr) return false
      if (!b.start_time || !b.end_time) return false
      const { h: bsh, m: bsm } = parseTime(b.start_time)
      const { h: beh, m: bem } = parseTime(b.end_time)
      const blockStart = setSeconds(setMinutes(setHours(date, bsh), bsm), 0)
      const blockEnd = setSeconds(setMinutes(setHours(date, beh), bem), 0)
      return isBefore(cursor, blockEnd) && isAfter(slotEnd, blockStart)
    })

    if (isSlotBlocked) {
      cursor = addMinutes(cursor, 30)
      continue
    }

    // Check existing appointments overlap (status 'confirmed' or 'completed' takes up time)
    const hasConflict = appointments
      .filter((a) => a.appointment_date === dateStr && (a.status === 'confirmed' || a.status === 'completed'))
      .some((a) => {
        const [ah, am] = a.appointment_time.split(':').map(Number)
        const apptStart = setSeconds(setMinutes(setHours(date, ah), am), 0)
        // We need the service duration for the existing appointment
        const apptDuration = a.service?.duration_minutes ?? 60
        const apptEnd = addMinutes(apptStart, apptDuration)
        return isBefore(cursor, apptEnd) && isAfter(slotEnd, apptStart)
      })

    if (!hasConflict) {
      slots.push(slotStr)
    }

    cursor = addMinutes(cursor, 30)
  }

  return slots
}

/**
 * Earliest bookable date for an item: today, unless today has no slots left
 * (already closed, fully booked, or every remaining slot is in the past) —
 * in that case, the next working day.
 */
export function getBookingFloor(
  itemOrDuration: Service | number,
  workingHours: WorkingHours,
  appointments: Appointment[],
  blockedSlots: BlockedSlot[]
): Date {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todaySlots = getAvailableSlots(today, itemOrDuration, workingHours, appointments, blockedSlots)
  if (todaySlots.length > 0) return today
  return addWorkingDays(today, 1, workingHours, blockedSlots)
}

/** Format price to pt-BR currency string */
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(price)
}

/** Format duration to human-readable string */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (m === 0) return `${h}h`
  return `${h}h ${m}min`
}

/** Format phone with BR mask */
export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 11)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  return value
}

/** Strip non-digits from phone */
export function rawPhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

/** Format date to pt-BR */
export function formatDateBR(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`
}

/** Day names for display */
export const DAY_NAMES_PT: Record<keyof WorkingHours, string> = {
  sunday: 'Domingo',
  monday: 'Segunda-feira',
  tuesday: 'Terça-feira',
  wednesday: 'Quarta-feira',
  thursday: 'Quinta-feira',
  friday: 'Sexta-feira',
  saturday: 'Sábado',
}

/** Build clean pre-filled WhatsApp URL without emoji encoding issues */
export function buildWhatsAppUrl(
  name: string,
  serviceOrComboName: string,
  date: string,
  time: string,
  price: string,
  cancelUrl?: string
): string {
  let msg = `Olá, Joyce! Meu nome é ${name}.\n\n`
  msg += `Acabei de agendar ${serviceOrComboName} para o dia ${date} às ${time}.\n`
  msg += `Valor: ${price}.\n\n`
  msg += `Te vejo lá!`

  if (cancelUrl) {
    msg += `\n\n-----------------------------------\n`
    msg += `Precisa reagendar ou cancelar? Use o link abaixo:\n${cancelUrl}`
  }

  return `https://wa.me/5511997361024?text=${encodeURIComponent(msg)}`
}

/** Build clean WhatsApp URL for a Combo with 4 sessions */
export function buildComboWhatsAppUrl(
  name: string,
  comboName: string,
  sessions: { date: string; time: string; serviceName?: string }[],
  totalPrice: string,
  cancelUrl?: string
): string {
  const sessionsText = sessions
    .map((s, idx) => `  • Sessão ${idx + 1}${s.serviceName ? ` (${s.serviceName})` : ''}: ${s.date} às ${s.time}`)
    .join('\n')

  let msg = `Olá, Joyce! Meu nome é ${name}.\n\n`
  msg += `Acabei de agendar o Combo ${comboName} (4 sessões):\n${sessionsText}\n\n`
  msg += `Total: ${totalPrice}.\n\n`
  msg += `Te vejo lá!`

  if (cancelUrl) {
    msg += `\n\n-----------------------------------\n`
    msg += `Precisa reagendar ou cancelar? Use o link abaixo:\n${cancelUrl}`
  }

  return `https://wa.me/5511997361024?text=${encodeURIComponent(msg)}`
}
