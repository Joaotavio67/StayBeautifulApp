import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import type { Appointment, Service, BlockedSlot, WorkingHours } from '../../lib/supabase'
import { formatDateBR, formatPrice, formatPhone, rawPhone, getAvailableSlots, getBookingFloor, buildWhatsAppUrl } from '../../lib/utils'
import { removeCalendarEventForAppointment, syncAppointmentToCalendar } from '../../lib/calendar'
import { format, isToday, parseISO, startOfWeek, endOfWeek } from 'date-fns'
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

const EMPTY_MANUAL_FORM = { serviceId: '', clientName: '', clientPhone: '', date: null as Date | null, time: null as string | null }

export default function AdminAgendaPage() {
  const [appointments, setAppointments] = useState<AppointmentWithService[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabId>('today')
  const [toast, setToast] = useState('')

  // Data needed for the manual booking form's date/time picker
  const [services, setServices] = useState<Service[]>([])
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
    const [svcRes, blockedRes, settingsRes] = await Promise.all([
      supabase.from('services').select('*').eq('is_active', true).order('name'),
      supabase.from('blocked_slots').select('*').eq('is_active', true),
      supabase.from('settings').select('*').eq('key', 'working_hours').single(),
    ])
    if (svcRes.data) setServices(svcRes.data)
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
    const joycesPhone = '5511997361024'
    const googleMapsLink = 'https://g.page/r/CUA5DyGfibTEBM/review'

    const message = `Olá ${clientName}! 😊\n\nObrigada por escolher nosso serviço! Você gostaria de nos avaliar no Google Maps? Deixe uma avaliação com 5 ⭐, um comentário e, se possível, compartilhe fotos ou vídeos da sua experiência.\n\nLink para avaliar:\n${googleMapsLink}\n\nAgradecemos muito! 🙏`

    const encodedMessage = encodeURIComponent(message)
    const whatsappUrl = `https://wa.me/${joycesPhone}?text=${encodedMessage}`

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

  const manualSelectedService = services.find(s => s.id === manualForm.serviceId) || null
  const manualSlots = manualForm.date && manualSelectedService
    ? getAvailableSlots(manualForm.date, manualSelectedService, workingHours, appointments, blockedSlots)
    : []
  const manualMinDate = manualSelectedService
    ? getBookingFloor(manualSelectedService, workingHours, appointments, blockedSlots)
    : undefined

  async function handleSaveManual() {
    if (!manualSelectedService || !manualForm.clientName.trim() || !manualForm.date || !manualForm.time) {
      alert('Preencha o serviço, nome da cliente, data e horário.')
      return
    }
    const digits = rawPhone(manualForm.clientPhone)
    if (digits.length < 10) {
      alert('Informe um telefone celular válido.')
      return
    }

    setSavingManual(true)
    try {
      const dateStr = format(manualForm.date, 'yyyy-MM-dd')
      const { data: appt, error } = await supabase
        .from('appointments')
        .insert({
          service_id: manualSelectedService.id,
          client_name: manualForm.clientName.trim(),
          client_phone: digits,
          appointment_date: dateStr,
          appointment_time: manualForm.time + ':00',
          status: 'confirmed',
          price: manualSelectedService.price,
          avisado_whatsapp: false,
        })
        .select('*, service:services(*)')
        .single()

      if (error || !appt) throw error || new Error('Não foi possível salvar o agendamento.')

      syncAppointmentToCalendar({
        appointmentId: appt.id,
        clientName: manualForm.clientName.trim(),
        clientPhone: manualForm.clientPhone,
        serviceName: manualSelectedService.name,
        date: dateStr,
        time: manualForm.time,
        durationMinutes: manualSelectedService.duration_minutes,
        notes: 'Migrado de outro sistema de agendamento',
      })

      const cancelUrl = `${window.location.origin}/cancelar/${appt.cancel_token}`
      const waUrl = buildWhatsAppUrl(
        manualForm.clientName.trim(),
        manualSelectedService.name,
        formatDateBR(dateStr),
        manualForm.time,
        `A partir de ${formatPrice(manualSelectedService.price)}`,
        cancelUrl
      )
      window.open(waUrl, '_blank')

      setToast('Agendamento criado, sincronizado com a agenda e mensagem aberta no WhatsApp!')
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
  const weekStart = startOfWeek(now, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 })

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
            onClick={() => setTab(t.id)}
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

      {filtered.map(appt => {
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
                <div>✂️ {isCombo ? appt.combo_name : appt.service?.name}</div>
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

      {manualModalOpen && (
        <Modal title="Agendamento manual" onClose={() => setManualModalOpen(false)}>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginBottom: '1rem' }}>
            Use para agendar clientes que não têm o link ou tiveram dificuldade em agendar sozinhas (ou para migrar um agendamento feito em outro sistema). Reserva o horário aqui, salva na agenda do Google Calendar e envia a confirmação pelo WhatsApp, do mesmo jeito que um agendamento feito pela cliente no site.
          </p>

          <div className="field">
            <label className="label">Serviço *</label>
            <select
              className="input"
              value={manualForm.serviceId}
              onChange={e => setManualForm(f => ({ ...f, serviceId: e.target.value, date: null, time: null }))}
            >
              <option value="">Selecione...</option>
              {services.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.duration_minutes} min · {formatPrice(s.price)})</option>
              ))}
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

          {manualSelectedService && (
            <div className="field">
              <label className="label">Data *</label>
              <Calendar
                key={manualForm.serviceId}
                selected={manualForm.date}
                onSelect={d => setManualForm(f => ({ ...f, date: d, time: null }))}
                workingHours={workingHours}
                blockedSlots={blockedSlots}
                minDate={manualMinDate}
              />
            </div>
          )}

          {manualForm.date && manualSelectedService && (
            <div className="field">
              <label className="label">Horário *</label>
              {manualSlots.length === 0 ? (
                <p style={{ color: '#8B0000', fontStyle: 'italic', fontSize: '0.9rem' }}>
                  Nenhum horário disponível nesta data.
                </p>
              ) : (
                <div className="slots-grid">
                  {manualSlots.map(slot => (
                    <div
                      key={slot}
                      className={`slot${manualForm.time === slot ? ' slot--selected' : ''}`}
                      onClick={() => setManualForm(f => ({ ...f, time: slot }))}
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
              {savingManual ? 'Salvando...' : 'Salvar agendamento'}
            </button>
          </div>
        </Modal>
      )}

      {reschedulingAppt && (
        <Modal title="Reagendar" onClose={() => setReschedulingAppt(null)}>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginBottom: '1rem' }}>
            {reschedulingAppt.client_name} — {reschedulingAppt.combo_group_id ? reschedulingAppt.combo_name : reschedulingAppt.service?.name}
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
