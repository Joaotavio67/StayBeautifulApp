import { supabase } from './supabase'

export interface CreateCalendarEventInput {
  appointmentId: string
  clientName: string
  clientPhone?: string
  serviceName: string
  date: string // YYYY-MM-DD
  time: string // HH:MM or HH:MM:SS
  durationMinutes: number
  notes?: string
}

/**
 * Creates an event on Joyce's Google Calendar for a confirmed appointment,
 * with a popup reminder 2h before. Failures are logged but never block the
 * booking flow — the appointment is already saved in the database either way.
 */
export async function syncAppointmentToCalendar(input: CreateCalendarEventInput): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke('calendar-sync', {
      body: { action: 'create', ...input },
    })
    if (error) console.error('[calendar] create failed:', error)
  } catch (err) {
    console.error('[calendar] create failed:', err)
  }
}

export async function removeCalendarEventForAppointment(appointmentId: string): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke('calendar-sync', {
      body: { action: 'deleteByAppointment', appointmentId },
    })
    if (error) console.error('[calendar] delete failed:', error)
  } catch (err) {
    console.error('[calendar] delete failed:', err)
  }
}

export async function removeCalendarEventsForComboGroup(comboGroupId: string): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke('calendar-sync', {
      body: { action: 'deleteByComboGroup', comboGroupId },
    })
    if (error) console.error('[calendar] delete combo failed:', error)
  } catch (err) {
    console.error('[calendar] delete combo failed:', err)
  }
}
