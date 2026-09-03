import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Copy .env.example to .env and fill in your credentials.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ── Types ────────────────────────────────────────────────────────────────────

export interface Service {
  id: string
  name: string
  description: string | null
  duration_minutes: number
  price: number
  is_active: boolean
  created_at: string
}

export interface Combo {
  id: string
  name: string
  description: string | null
  service_id_1: string
  service_id_2: string
  service_id_3: string
  service_id_4: string
  price: number
  is_active: boolean
  created_at: string
  service1?: Service
  service2?: Service
  service3?: Service
  service4?: Service
}

export interface Appointment {
  id: string
  service_id: string | null
  client_name: string
  client_phone: string
  appointment_date: string   // YYYY-MM-DD
  appointment_time: string   // HH:MM:SS
  status: 'confirmed' | 'cancelled' | 'completed'
  cancel_token: string
  notes: string | null
  price?: number | null
  avisado_whatsapp?: boolean
  combo_group_id?: string | null
  combo_session_index?: number | null
  combo_name?: string | null
  google_event_id?: string | null
  created_at: string
  service?: Service
}

export interface BlockedSlot {
  id: string
  blocked_date: string       // YYYY-MM-DD
  start_time: string | null  // HH:MM — null = dia inteiro
  end_time: string | null
  reason: string | null
  is_active: boolean
  created_at: string
}

export interface WorkingHoursDay {
  open: string    // "HH:MM"
  close: string   // "HH:MM"
  enabled: boolean
}

export type WorkingHours = {
  monday: WorkingHoursDay
  tuesday: WorkingHoursDay
  wednesday: WorkingHoursDay
  thursday: WorkingHoursDay
  friday: WorkingHoursDay
  saturday: WorkingHoursDay
  sunday: WorkingHoursDay
}
