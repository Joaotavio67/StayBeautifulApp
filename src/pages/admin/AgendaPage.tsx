import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import type { Appointment, Service, Combo, BlockedSlot, WorkingHours } from '../../lib/supabase'
import { formatDateBR, formatPrice, formatPhone, rawPhone, getAvailableSlots, getBookingFloor, buildWhatsAppUrl, buildComboWhatsAppUrl, hasAppointmentConflict, addWorkingDays, getComboSessionService } from '../../lib/utils'
import { removeCalendarEventForAppointment, syncAppointmentToCalendar } from '../../lib/calendar'
import { format, isToday, parseISO, startOfWeek, endOfWeek, addDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Calendar from '../../components/Calendar'

type AppointmentWithService = Appointment & { service?: Service }

type TabId = 'today' | 'week' | 'all'

const DEFAULT_WORKING_HOURS: WorkingHours = {
  monday:    { open: '14:00', close: '20:00', enabled: true },
  tuesday:   { open: '14:00', close: '20:00', enabled: true },
  wednesday: { open: '14:00', close: '20:00', enabled: true },
  thursday:  { open: '14:00', close: '20:00', enabled: true },
  friday:    { open: '14:00', close: '20:00', enabled: true },
  saturday:  { open: '08:00', close: '18:00', enabled: true },
  sunday:    { open: '08:00', close: '18:00', enabled: false },
}

function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000)
    return () => clearTimeout(t)
  }, [onClose])
  return <div className="toast">{msg}</div>
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2 className="modal__title">{title}</h2>
        {children}
      </div>
    </div>
  )
}

type ManualSession = { date: Date | null; time: string | null; outsideHours: boolean }

const EMPTY_SESSION: ManualSession = { date: null, time: null, outsideHours: false }

// Same rules as the public booking page: each combo session must be at least
// 5 working days after the previous one, and all 4 within 30 days of the first.
const MIN_SESSION_GAP_DAYS = 5
const COMBO_WINDOW_DAYS = 30
const COMBO_PREFIX = 'combo:'

// itemKey is '' (nothing), a service id, or 'combo:<comboId>'.
// A service booking uses a single session; a combo uses 4.
const EMPTY_MANUAL_FORM = {
  itemKey: '',
  clientName: '',
  clientPhone: '',
  sessions: [EMPTY_SESSION] as ManualSession[],
  activeSession: 0,
}

export default function AdminAgendaPage() {
  const [appointments, setAppointments] = useState<AppointmentWithService[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabId>('today')
  const [toast, setToast] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  // Data needed for the manual booking form's date/time picker
  const [services, setServices] = useState<Service[]>([])
  const [combos, setCombos] = useState<Combo[]>([])
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([])
  const [workingHours, setWorkingHours] = useState<WorkingHours>(DEFAULT_WORKING_HOURS)

  const [manualModalOpen, setManualModalOpen] = useState(false)
  const [manualForm, setManualForm] = useState(EMPTY_MANUAL_FORM)
  const [savingManual, setSavingManual] = useState(false)

  const [reschedulingAppt, setReschedulingAppt] = useState<AppointmentWithService | null>(null)
  const [rescheduleDate, setRescheduleDate] = useState<Date | null>(null)
  const [rescheduleTime, setRescheduleTime] = useState<string | null>(null)
  const [savingReschedule, setSavingReschedule] = useState(false)

  async function loadAppointments() {
    const { data } = await supabase
      .from('appointments')
      .select('*, service:services(*)')
      .order('appointment_date', { ascending: true })
      .order('appointment_time', { ascending: true })
    if (data) setAppointments(data as AppointmentWithService[])
    setLoading(false)
  }

  async function loadSchedulingData() {
    const [svcRes, comboRes, blockedRes, settingsRes] = await Promise.all([
      supabase.from('services').select('*').order('name'),
      supabase.from('combos').select('*').eq('is_active', true).order('name'),
      supabase.from('blocked_slots').select('*').eq('is_active', true),
      supabase.from('settings').select('*').eq('key', 'working_hours').single(),
    ])
    const allServices: Service[] = svcRes.data || []
    setServices(allServices.filter(s => s.is_active))
    if (comboRes.data) {
      // Hydrate service1..service4 (from all services, so a combo still works
      // even if one of its services was later deactivated)
      setCombos(comboRes.data.map((c: Combo) => ({
        ...c,
        service1: allServices.find(s => s.id === c.service_id_1),
        service2: allServices.find(s => s.id === c.service_id_2),
        service3: allServices.find(s => s.id === c.service_id_3),
        service4: allServices.find(s => s.id === c.service_id_4),
      })))
    }
    if (blockedRes.data) setBlockedSlots(blockedRes.data)
    if (settingsRes.data?.value) setWorkingHours(settingsRes.data.value as WorkingHours)
  }

  useEffect(() => { loadAppointments(); loadSchedulingData() }, [])

  async function handleMarkCompleted(id: string, clientPhone: string, clientName: string) {
    const { error } = await supabase
      .from('appointments')
      .update({ status: 'completed' })
      .eq('id', id)

    if (!error) {
      setToast('Agendamento marcado como concluído! Movido para o Histórico.')
      handleRequestReview(clientPhone, clientName)
      loadAppointments()
    } else {
      alert('Erro ao concluir agendamento.')
    }
  }

  function handleRequestReview(clientPhone: string, clientName: string) {
    const googleMapsLink = 'https://g.page/r/CUA5DyGfibTEEBM/review'

    let message = `Olá ${clientName}!\n\n`
    message += `Obrigada por escolher nosso serviço! Você poderia nos avaliar no Google Maps? 🌟\n\n`
    message += `Deixe uma avaliação com 5 estrelas, um comentário e, se possível, compartilhe fotos ou vídeos da sua experiência.\n\n`
    message += `Link para avaliar:\n${googleMapsLink}\n\n`
    message += `Agradecemos muito! 💖`

    const encodedMessage = encodeURIComponent(message)
    const whatsappUrl = `https://wa.me/55${clientPhone.replace(/\D/g, '')}?text=${encodedMessage}`

    window.open(whatsappUrl, '_blank')
  }

  async function handleCancel(id: string) {
    if (!confirm('Cancelar este agendamento?')) return
    await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', id)
    removeCalendarEventForAppointment(id)
    setToast('Agendamento cancelado.')
    loadAppointments()
  }

  async function handleReactivate(appt: AppointmentWithService) {
    if (!confirm(`Reativar agendamento de ${appt.client_name}?`)) return

    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'confirmed' })
        .eq('id', appt.id)

      if (error) throw error

      // Sync back to Google Calendar
      if (appt.service) {
        syncAppointmentToCalendar({
          appointmentId: appt.id,
          clientName: appt.client_name,
          clientPhone: appt.client_phone,
          serviceName: appt.service.name,
          date: appt.appointment_date,
          time: appt.appointment_time.slice(0, 5),
          durationMinutes: appt.service.duration_minutes,
        })
      }

      setToast('Agendamento reativado!')
      loadAppointments()
    } catch (err: any) {
      alert(`Erro ao reativar: ${err?.message || 'Tente novamente.'}`)
    }
  }

  function copyCancelLink(token: string) {
    const url = `${window.location.origin}/cancelar/${token}`
    navigator.clipboard.writeText(url)
    setToast('Link de cancelamento copiado!')
  }

  function openManualModal() {
    setManualForm(EMPTY_MANUAL_FORM)
    setManualModalOpen(true)
  }

  // ── Manual booking: service (1 session) or combo (4 sessions) ──
  const manualCombo = manualForm.itemKey.startsWith(COMBO_PREFIX)
    ? combos.find(c => COMBO_PREFIX + c.id === manualForm.itemKey) || null
    : null
  const manualService = manualCombo ? null : services.find(s => s.id === manualForm.itemKey) || null
  const manualSessionServices: (Service | undefined)[] = manualCombo
    ? [0, 1, 2, 3].map(i => getComboSessionService(manualCombo, i).service)
    : manualService ? [manualService] : []

  const activeIdx = manualForm.activeSession
  const activeManualSession = manualForm.sessions[activeIdx] ?? EMPTY_SESSION
  const activeManualService = manualSessionServices[activeIdx] || null

  // Sessions must be filled in order: a tab unlocks once every earlier one has date + time
  const firstEmptyManualIdx = manualForm.sessions.findIndex(s => !s.date || !s.time)
  const lastUnlockedManualIdx = firstEmptyManualIdx === -1 ? manualForm.sessions.length - 1 : firstEmptyManualIdx
  const filledManualSessions = manualForm.sessions.filter(s => s.date && s.time).length

  const previousManualSession = manualCombo && activeIdx > 0 ? manualForm.sessions[activeIdx - 1] : null
  const manualSessionMinDate = previousManualSession?.date
    ? addWorkingDays(previousManualSession.date, MIN_SESSION_GAP_DAYS, workingHours, blockedSlots)
    : null
  const manualComboMaxDate = manualCombo && activeIdx > 0 && manualForm.sessions[0].date
    ? addDays(manualForm.sessions[0].date, COMBO_WINDOW_DAYS)
    : null

  const manualSlots = activeManualSession.date && activeManualService
    ? getAvailableSlots(activeManualSession.date, activeManualService, workingHours, appointments, blockedSlots)
    : []
  const manualMinDate = manualSessionMinDate
    ?? (activeManualService
      ? (activeManualSession.outsideHours ? new Date() : getBookingFloor(activeManualService, workingHours, appointments, blockedSlots))
      : undefined)

  function selectManualItem(itemKey: string) {
    const sessionCount = itemKey.startsWith(COMBO_PREFIX) ? 4 : 1
    setManualForm(f => ({
      ...f,
      itemKey,
      sessions: Array.from({ length: sessionCount }, () => ({ ...EMPTY_SESSION })),
      activeSession: 0,
    }))
  }

  /** Updates the active session. Any later sessions are cleared, since their
   * dates may no longer respect the order / minimum gap. */
  function updateActiveSession(patch: Partial<ManualSession>, advance = false) {
    setManualForm(f => {
      const sessions = [...f.sessions]
      sessions[f.activeSession] = { ...sessions[f.activeSession], ...patch }
      for (let i = f.activeSession + 1; i < sessions.length; i++) sessions[i] = { ...EMPTY_SESSION }
      const activeSession = advance && f.activeSession < sessions.length - 1 ? f.activeSession + 1 : f.activeSession
      return { ...f, sessions, activeSession }
    })
  }

  async function saveManualService(service: Service, clientName: string, digits: string) {
    const session = manualForm.sessions[0]
    const dateStr = format(session.date!, 'yyyy-MM-dd')
    const time = session.time!
    const { data: appt, error } = await supabase
      .from('appointments')
      .insert({
        service_id: service.id,
        client_name: clientName,
        client_phone: digits,
        appointment_date: dateStr,
        appointment_time: time + ':00',
        status: 'confirmed',
        price: service.price,
        avisado_whatsapp: false,
      })
      .select('*, service:services(*)')
      .single()

    if (error || !appt) throw error || new Error('Não foi possível salvar o agendamento.')

    syncAppointmentToCalendar({
      appointmentId: appt.id,
      clientName,
      clientPhone: manualForm.clientPhone,
      serviceName: service.name,
      date: dateStr,
      time,
      durationMinutes: service.duration_minutes,
      notes: 'Migrado de outro sistema de agendamento',
    })

    const cancelUrl = `${window.location.origin}/cancelar/${appt.cancel_token}`
    window.open(buildWhatsAppUrl(
      clientName,
      service.name,
      formatDateBR(dateStr),
      time,
      `A partir de ${formatPrice(service.price)}`,
      cancelUrl
    ), '_blank')
  }

  async function saveManualCombo(combo: Combo, clientName: string, digits: string) {
    // 4 appointments sharing a combo_group_id, price split like the public booking page
    const comboGroupId = crypto.randomUUID()
    const baseSessionPrice = Math.floor((combo.price / 4) * 100) / 100
    const remainder = Math.round((combo.price - baseSessionPrice * 4) * 100) / 100

    const sessions = manualForm.sessions.map((s, idx) => ({
      dateStr: format(s.date!, 'yyyy-MM-dd'),
      time: s.time!,
      service: manualSessionServices[idx]!,
      price: idx === 3 ? baseSessionPrice + remainder : baseSessionPrice,
    }))

    const { data: created, error } = await supabase
      .from('appointments')
      .insert(sessions.map((s, idx) => ({
        service_id: s.service.id,
        client_name: clientName,
        client_phone: digits,
        appointment_date: s.dateStr,
        appointment_time: s.time + ':00',
        status: 'confirmed',
        price: s.price,
        combo_group_id: comboGroupId,
        combo_session_index: idx + 1,
        combo_name: combo.name,
        avisado_whatsapp: false,
      })))
      .select('*')

    if (error || !created || created.length === 0) throw error || new Error('Não foi possível salvar o combo.')

    // Inserted rows come back in insert order; match by session index to be safe
    for (const appt of created) {
      const s = sessions[(appt.combo_session_index ?? 1) - 1]
      syncAppointmentToCalendar({
        appointmentId: appt.id,
        clientName,
        clientPhone: manualForm.clientPhone,
        serviceName: s.service.name,
        date: s.dateStr,
        time: s.time,
        durationMinutes: s.service.duration_minutes,
        notes: `Sessão ${appt.combo_session_index} de 4 — ${combo.name}`,
      })
    }

    const firstAppt = created.find(a => a.combo_session_index === 1) ?? created[0]
    const cancelUrl = `${window.location.origin}/cancelar/${firstAppt.cancel_token}`
    window.open(buildComboWhatsAppUrl(
      clientName,
      combo.name,
      sessions.map(s => ({ date: formatDateBR(s.dateStr), time: s.time, serviceName: s.service.name })),
      formatPrice(combo.price),
      cancelUrl
    ), '_blank')
  }

  async function handleSaveManual() {
    const clientName = manualForm.clientName.trim()
    if (manualSessionServices.length === 0 || !clientName) {
      alert('Preencha o serviço (ou combo) e o nome da cliente.')
      return
    }
    if (manualSessionServices.some(s => !s)) {
      alert('Um dos serviços deste combo não foi encontrado. Verifique o combo na tela de Serviços.')
      return
    }
    if (firstEmptyManualIdx !== -1) {
      alert(manualCombo
        ? `Escolha a data e o horário da Sessão ${firstEmptyManualIdx + 1}.`
        : 'Escolha a data e o horário.')
      return
    }
    const digits = rawPhone(manualForm.clientPhone)
    if (digits.length < 10) {
      alert('Informe um telefone celular válido.')
      return
    }
    const conflictIdx = manualForm.sessions.findIndex((s, idx) =>
      s.outsideHours && hasAppointmentConflict(s.date!, s.time!, manualSessionServices[idx]!.duration_minutes, appointments)
    )
    if (conflictIdx !== -1) {
      alert(manualCombo
        ? `Já existe um agendamento que ocupa o horário da Sessão ${conflictIdx + 1}. Escolha outro horário.`
        : 'Já existe um agendamento que ocupa esse horário. Escolha outro horário.')
      return
    }

    setSavingManual(true)
    try {
      if (manualCombo) {
        await saveManualCombo(manualCombo, clientName, digits)
      } else {
        await saveManualService(manualService!, clientName, digits)
      }

      setToast(manualCombo
        ? 'Combo criado (4 sessões), sincronizado com a agenda e mensagem aberta no WhatsApp!'
        : 'Agendamento criado, sincronizado com a agenda e mensagem aberta no WhatsApp!')
      setManualModalOpen(false)
      setManualForm(EMPTY_MANUAL_FORM)
      loadAppointments()
    } catch (err: any) {
      alert(`Erro ao salvar agendamento: ${err?.message || 'Tente novamente.'}`)
    } finally {
      setSavingManual(false)
    }
  }

  function openReschedule(appt: AppointmentWithService) {
    setReschedulingAppt(appt)
    setRescheduleDate(parseISO(appt.appointment_date))
    setRescheduleTime(appt.appointment_time.slice(0, 5))
  }

  // Exclude the appointment being rescheduled from conflict checks, so its
  // own current slot doesn't show up as "unavailable" when picking a new time.
  const appointmentsForReschedule = reschedulingAppt
    ? appointments.filter(a => a.id !== reschedulingAppt.id)
    : appointments

  const rescheduleSlots = rescheduleDate && reschedulingAppt?.service
    ? getAvailableSlots(rescheduleDate, reschedulingAppt.service, workingHours, appointmentsForReschedule, blockedSlots)
    : []
  const rescheduleMinDate = reschedulingAppt?.service
    ? getBookingFloor(reschedulingAppt.service, workingHours, appointmentsForReschedule, blockedSlots)
    : undefined

  async function handleSaveReschedule() {
    if (!reschedulingAppt || !rescheduleDate || !rescheduleTime) {
      alert('Selecione a nova data e horário.')
      return
    }
    setSavingReschedule(true)
    try {
      const newDateStr = format(rescheduleDate, 'yyyy-MM-dd')
      const { error } = await supabase
        .from('appointments')
        .update({ appointment_date: newDateStr, appointment_time: rescheduleTime + ':00' })
        .eq('id', reschedulingAppt.id)

      if (error) throw error

      // Free the old calendar event and create a fresh one at the new date/time
      await removeCalendarEventForAppointment(reschedulingAppt.id)
      syncAppointmentToCalendar({
        appointmentId: reschedulingAppt.id,
        clientName: reschedulingAppt.client_name,
        clientPhone: reschedulingAppt.client_phone,
        serviceName: reschedulingAppt.service?.name ?? reschedulingAppt.combo_name ?? 'Serviço',
        date: newDateStr,
        time: rescheduleTime,
        durationMinutes: reschedulingAppt.service?.duration_minutes ?? 60,
      })

      setToast('Agendamento reagendado! O horário antigo foi liberado.')
      setReschedulingAppt(null)
      loadAppointments()
    } catch (err: any) {
      alert(`Erro ao reagendar: ${err?.message || 'Tente novamente.'}`)
    } finally {
      setSavingReschedule(false)
    }
  }

  const now = new Date()
  const weekStart = startOfWeek(now, { weekStartsOn: 0 })
  const weekEnd = endOfWeek(now, { weekStartsOn: 0 })

  // Agenda shows active/pending appointments (status === 'confirmed').
  // 'completed' items move to History, 'cancelled' shown only under 'all'
  const filtered = appointments.filter(a => {
    if (a.status === 'completed') return false // moves to History
    if (a.status === 'cancelled' && tab !== 'all') return false
    const d = parseISO(a.appointment_date)
    if (tab === 'today') return isToday(d) && a.status === 'confirmed'
    if (tab === 'week') return d >= weekStart && d <= weekEnd && a.status === 'confirmed'
    return true
  })

  const TABS: { id: TabId; label: string }[] = [
    { id: 'today', label: 'Hoje' },
    { id: 'week', label: 'Esta semana' },
    { id: 'all', label: 'Todos' },
  ]

  const ITEMS_PER_PAGE = 5
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE
  const paginatedAppointments = filtered.slice(startIdx, startIdx + ITEMS_PER_PAGE)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem', marginBottom: '0.25rem' }}>Agenda</h1>
          <p style={{ color: 'var(--color-black)', fontSize: '0.9rem' }}>
            {format(now, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
        <button className="btn" onClick={openManualModal}>+ Agendamento manual</button>
      </div>

      <div className="tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`tab${tab === t.id ? ' tab--active' : ''}`}
            onClick={() => { setTab(t.id); setCurrentPage(1) }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <div className="spinner" />}

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-black)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>📭</div>
          <p style={{ fontStyle: 'italic', fontSize: '1rem' }}>
            {tab === 'today' ? 'Nenhum agendamento para hoje.' : 'Nenhum agendamento ativo encontrado.'}
          </p>
        </div>
      )}

      {filtered.length > 0 && totalPages > 1 && (
        <div style={{ marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--color-muted)' }}>
          Página {currentPage} de {totalPages} · {filtered.length} total
        </div>
      )}

      {paginatedAppointments.map(appt => {
        const isCombo = Boolean(appt.combo_group_id)
        const price = appt.price ?? appt.service?.price ?? 0

        return (
          <div key={appt.id} className="appt-card">
            <div className="appt-card__info">
              <div className="appt-card__name">
                {appt.client_name}
                {isCombo && (
                  <span className="badge badge--combo" style={{ marginLeft: '0.5rem' }}>
                    {appt.combo_name || 'Combo'} {appt.combo_session_index ? `· Sessão ${appt.combo_session_index} de 4` : ''}
                  </span>
                )}
              </div>
              <div className="appt-card__meta">
                <div>
                  📱{' '}
                  <a
                    href={`https://wa.me/55${appt.client_phone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'inherit', textDecoration: 'underline' }}
                  >
                    {appt.client_phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}
                  </a>
                </div>
                <div>✂️ {appt.service?.name ?? appt.combo_name}</div>
                <div>📅 {formatDateBR(appt.appointment_date)} às {appt.appointment_time.slice(0, 5)}</div>
                <div>💰 A partir de {formatPrice(price)}</div>
                {appt.avisado_whatsapp && (
                  <div style={{ color: '#2d4a2d', fontWeight: 600, fontSize: '0.82rem', marginTop: '0.2rem' }}>
                    ✓ Cliente avisou pelo WhatsApp
                  </div>
                )}
              </div>
            </div>
            <div className="appt-card__actions">
              <span className={`badge badge--${appt.status}`}>
                {appt.status === 'confirmed' ? 'Confirmado' : 'Cancelado'}
              </span>

              {appt.status === 'confirmed' && (
                <button
                  className="btn btn--filled btn--sm"
                  onClick={() => handleMarkCompleted(appt.id, appt.client_phone, appt.client_name)}
                  title="Marcar como concluído e enviar pedido de avaliação no Google Maps"
                >
                  ✓ Concluído
                </button>
              )}

              {appt.status === 'confirmed' && (
                <button
                  className="btn btn--sm"
                  onClick={() => openReschedule(appt)}
                >
                  Reagendar
                </button>
              )}

              {appt.status === 'confirmed' && (
                <button
                  className="btn btn--danger btn--sm"
                  onClick={() => handleCancel(appt.id)}
                >
                  Cancelar
                </button>
              )}

              {appt.status === 'cancelled' && (
                <button
                  className="btn btn--filled btn--sm"
                  onClick={() => handleReactivate(appt)}
                  title="Reativar este agendamento"
                >
                  ↺ Reativar
                </button>
              )}

              <a
                href={`https://wa.me/55${appt.client_phone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn--sm"
              >
                WhatsApp
              </a>

              <button
                className="btn btn--ghost btn--sm"
                onClick={() => copyCancelLink(appt.cancel_token)}
                title="Copiar link de cancelamento da cliente"
              >
                🔗 Link Cliente
              </button>
            </div>
          </div>
        )
      })}

      {filtered.length > 0 && totalPages > 1 && (
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '2rem', marginBottom: '1rem' }}>
          <button
            className="btn btn--sm"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            ← Anterior
          </button>
          <button
            className="btn btn--sm"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Próxima →
          </button>
        </div>
      )}

      {manualModalOpen && (
        <Modal title="Agendamento manual" onClose={() => setManualModalOpen(false)}>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginBottom: '1rem' }}>
            Use para agendar clientes que não têm o link ou tiveram dificuldade em agendar sozinhas (ou para migrar um agendamento feito em outro sistema). Reserva o horário aqui, salva na agenda do Google Calendar e envia a confirmação pelo WhatsApp, do mesmo jeito que um agendamento feito pela cliente no site.
          </p>

          <div className="field">
            <label className="label">Serviço ou combo *</label>
            <select
              className="input"
              value={manualForm.itemKey}
              onChange={e => selectManualItem(e.target.value)}
            >
              <option value="">Selecione...</option>
              {combos.length > 0 && (
                <optgroup label="Combos (4 sessões)">
                  {combos.map(c => (
                    <option key={c.id} value={COMBO_PREFIX + c.id}>{c.name} (4 sessões · {formatPrice(c.price)})</option>
                  ))}
                </optgroup>
              )}
              <optgroup label="Serviços avulsos">
                {services.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.duration_minutes} min · {formatPrice(s.price)})</option>
                ))}
              </optgroup>
            </select>
          </div>

          <div className="field">
            <label className="label">Nome da cliente *</label>
            <input
              className="input"
              value={manualForm.clientName}
              onChange={e => setManualForm(f => ({ ...f, clientName: e.target.value }))}
              placeholder="Nome completo"
            />
          </div>

          <div className="field">
            <label className="label">WhatsApp / Telefone *</label>
            <input
              className="input"
              type="tel"
              value={manualForm.clientPhone}
              onChange={e => setManualForm(f => ({ ...f, clientPhone: formatPhone(e.target.value) }))}
              placeholder="(11) 99999-9999"
            />
          </div>

          {manualCombo && (
            <div className="field">
              <label className="label">Sessões do combo *</label>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginBottom: '0.5rem' }}>
                Escolha a data e o horário de cada sessão, em ordem. Total do combo: {formatPrice(manualCombo.price)}.
              </p>
              <div className="session-tabs">
                {manualForm.sessions.map((s, idx) => {
                  const isFilled = Boolean(s.date && s.time)
                  const locked = idx > lastUnlockedManualIdx
                  return (
                    <button
                      key={idx}
                      type="button"
                      className={`session-tab${activeIdx === idx ? ' session-tab--active' : ''}${isFilled ? ' session-tab--filled' : ''}${locked ? ' session-tab--locked' : ''}`}
                      onClick={() => !locked && setManualForm(f => ({ ...f, activeSession: idx }))}
                      disabled={locked}
                    >
                      {locked ? '🔒 ' : ''}Sessão {idx + 1} · {manualSessionServices[idx]?.name ?? '—'}
                      {isFilled ? ` ✓ (${formatDateBR(format(s.date!, 'yyyy-MM-dd'))} ${s.time})` : ''}
                    </button>
                  )
                })}
              </div>
              {activeManualService && (
                <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginTop: '0.5rem' }}>
                  Agendando a <strong>Sessão {activeIdx + 1}</strong>: {activeManualService.name} ({activeManualService.duration_minutes} min)
                </p>
              )}
              {manualSessionMinDate && (
                <p style={{ fontSize: '0.82rem', color: 'var(--color-muted)', marginTop: '0.25rem' }}>
                  Esta sessão só pode ser marcada a partir de {formatDateBR(format(manualSessionMinDate, 'yyyy-MM-dd'))} (mínimo de {MIN_SESSION_GAP_DAYS} dias úteis após a sessão anterior).
                </p>
              )}
              {manualComboMaxDate && (
                <p style={{ fontSize: '0.82rem', color: 'var(--color-muted)', marginTop: '0.25rem' }}>
                  As 4 sessões precisam ser marcadas até {formatDateBR(format(manualComboMaxDate, 'yyyy-MM-dd'))} ({COMBO_WINDOW_DAYS} dias após a Sessão 1).
                </p>
              )}
            </div>
          )}

          {activeManualService && (
            <div className="field">
              <label className="label">Data *</label>
              <Calendar
                key={`${manualForm.itemKey}-${activeIdx}`}
                selected={activeManualSession.date}
                onSelect={d => updateActiveSession({ date: d, time: null })}
                workingHours={workingHours}
                blockedSlots={blockedSlots}
                minDate={manualMinDate}
                maxDate={manualComboMaxDate}
              />
            </div>
          )}

          {activeManualSession.date && activeManualService && (
            <div className="field">
              <label className="label">Horário *</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', marginBottom: '0.75rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={activeManualSession.outsideHours}
                  onChange={e => updateActiveSession({ outsideHours: e.target.checked, time: null })}
                />
                Encaixe fora do expediente (escolher qualquer horário)
              </label>
              {activeManualSession.outsideHours ? (
                <>
                  <input
                    className="input"
                    type="time"
                    value={activeManualSession.time ?? ''}
                    onChange={e => updateActiveSession({ time: e.target.value || null })}
                  />
                  {activeManualSession.time && hasAppointmentConflict(activeManualSession.date, activeManualSession.time, activeManualService.duration_minutes, appointments) && (
                    <p style={{ color: '#8B0000', fontStyle: 'italic', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                      Esse horário conflita com outro agendamento.
                    </p>
                  )}
                </>
              ) : manualSlots.length === 0 ? (
                <p style={{ color: '#8B0000', fontStyle: 'italic', fontSize: '0.9rem' }}>
                  Nenhum horário disponível nesta data.
                </p>
              ) : (
                <div className="slots-grid">
                  {manualSlots.map(slot => (
                    <div
                      key={slot}
                      className={`slot${activeManualSession.time === slot ? ' slot--selected' : ''}`}
                      onClick={() => updateActiveSession({ time: slot }, Boolean(manualCombo))}
                    >
                      {slot}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="modal__actions">
            <button className="btn btn--ghost" onClick={() => setManualModalOpen(false)}>Cancelar</button>
            <button className="btn btn--filled" onClick={handleSaveManual} disabled={savingManual}>
              {savingManual
                ? 'Salvando...'
                : manualCombo
                  ? (filledManualSessions < 4 ? `Preencha as 4 sessões (${filledManualSessions}/4)` : 'Salvar combo')
                  : 'Salvar agendamento'}
            </button>
          </div>
        </Modal>
      )}

      {reschedulingAppt && (
        <Modal title="Reagendar" onClose={() => setReschedulingAppt(null)}>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginBottom: '1rem' }}>
            {reschedulingAppt.client_name} — {reschedulingAppt.service?.name ?? reschedulingAppt.combo_name}
            <br />
            Data atual: {formatDateBR(reschedulingAppt.appointment_date)} às {reschedulingAppt.appointment_time.slice(0, 5)}
          </p>

          <div className="field">
            <label className="label">Nova data *</label>
            <Calendar
              selected={rescheduleDate}
              onSelect={d => { setRescheduleDate(d); setRescheduleTime(null) }}
              workingHours={workingHours}
              blockedSlots={blockedSlots}
              minDate={rescheduleMinDate}
            />
          </div>

          {rescheduleDate && (
            <div className="field">
              <label className="label">Novo horário *</label>
              {rescheduleSlots.length === 0 ? (
                <p style={{ color: '#8B0000', fontStyle: 'italic', fontSize: '0.9rem' }}>
                  Nenhum horário disponível nesta data.
                </p>
              ) : (
                <div className="slots-grid">
                  {rescheduleSlots.map(slot => (
                    <div
                      key={slot}
                      className={`slot${rescheduleTime === slot ? ' slot--selected' : ''}`}
                      onClick={() => setRescheduleTime(slot)}
                    >
                      {slot}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="modal__actions">
            <button className="btn btn--ghost" onClick={() => setReschedulingAppt(null)}>Cancelar</button>
            <button className="btn btn--filled" onClick={handleSaveReschedule} disabled={savingReschedule}>
              {savingReschedule ? 'Salvando...' : 'Confirmar novo horário'}
            </button>
          </div>
        </Modal>
      )}

      {toast && <Toast msg={toast} onClose={() => setToast('')} />}
    </div>
  )
}
