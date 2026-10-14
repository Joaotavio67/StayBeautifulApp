import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { WorkingHours } from './supabase'

/** Salon details editable in Admin → Configurações (settings key 'salon_info'). */
export type SalonInfo = {
  professional: string
  street: string
  neighborhood: string
  city: string
  whatsapp: string   // digits only, with DDD (e.g. 11997361024)
  instagram: string  // handle without '@'
}

export const DEFAULT_SALON_INFO: SalonInfo = {
  professional: 'Joyce Araújo',
  street: 'Rua Carmo Vieira, 430',
  neighborhood: 'Jardim Bom Jesus',
  city: 'Pirapora do Bom Jesus/SP',
  whatsapp: '11997361024',
  instagram: 'stay_beautiful.l',
}

export const DEFAULT_WORKING_HOURS: WorkingHours = {
  monday:    { open: '14:00', close: '20:00', enabled: true },
  tuesday:   { open: '14:00', close: '20:00', enabled: true },
  wednesday: { open: '14:00', close: '20:00', enabled: true },
  thursday:  { open: '14:00', close: '20:00', enabled: true },
  friday:    { open: '14:00', close: '20:00', enabled: true },
  saturday:  { open: '08:00', close: '18:00', enabled: true },
  sunday:    { open: '08:00', close: '18:00', enabled: false },
}

/** Loads salon info and working hours from settings, falling back to defaults. */
export function useSalonInfo() {
  const [info, setInfo] = useState<SalonInfo>(DEFAULT_SALON_INFO)
  const [hours, setHours] = useState<WorkingHours>(DEFAULT_WORKING_HOURS)

  useEffect(() => {
    supabase
      .from('settings')
      .select('key, value')
      .in('key', ['salon_info', 'working_hours'])
      .then(({ data }) => {
        for (const row of data ?? []) {
          if (row.key === 'salon_info' && row.value) setInfo({ ...DEFAULT_SALON_INFO, ...row.value })
          if (row.key === 'working_hours' && row.value) setHours(row.value as WorkingHours)
        }
      })
  }, [])

  return { info, hours }
}

/** "(11) 99736-1024" */
export function formatWhatsapp(digits: string): string {
  const d = digits.replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return digits
}

export function mapsUrl(info: SalonInfo): string {
  const q = `${info.street} ${info.neighborhood} ${info.city}`
  return `https://maps.google.com/?q=${encodeURIComponent(q)}`
}

const DAY_ORDER: (keyof WorkingHours)[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const SHORT: Record<keyof WorkingHours, string> = {
  monday: 'Seg', tuesday: 'Ter', wednesday: 'Qua', thursday: 'Qui', friday: 'Sex', saturday: 'Sáb', sunday: 'Dom',
}
const FULL: Record<keyof WorkingHours, string> = {
  monday: 'Segunda', tuesday: 'Terça', wednesday: 'Quarta', thursday: 'Quinta', friday: 'Sexta', saturday: 'Sábado', sunday: 'Domingo',
}

/** "14:00" → "14h", "14:30" → "14h30" */
function fmtTime(t: string): string {
  const [h, m] = t.split(':')
  return `${Number(h)}h${m && m !== '00' ? m : ''}`
}

/**
 * Groups consecutive days with identical hours, e.g.
 * [{ days: 'Seg – Sex', time: '14h às 20h' }, { days: 'Sábado', time: '8h às 18h' }]
 */
export function formatHoursLines(hours: WorkingHours): { days: string; time: string }[] {
  const lines: { days: string; time: string }[] = []
  let i = 0
  while (i < DAY_ORDER.length) {
    const cfg = hours[DAY_ORDER[i]]
    if (!cfg?.enabled) { i++; continue }
    let j = i
    while (
      j + 1 < DAY_ORDER.length &&
      hours[DAY_ORDER[j + 1]]?.enabled &&
      hours[DAY_ORDER[j + 1]].open === cfg.open &&
      hours[DAY_ORDER[j + 1]].close === cfg.close
    ) j++
    const days = i === j ? FULL[DAY_ORDER[i]] : `${SHORT[DAY_ORDER[i]]} – ${SHORT[DAY_ORDER[j]]}`
    lines.push({ days, time: `${fmtTime(cfg.open)} às ${fmtTime(cfg.close)}` })
    i = j + 1
  }
  return lines
}
