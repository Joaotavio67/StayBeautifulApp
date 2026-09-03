import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, addDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import type { Service, Combo, Appointment, BlockedSlot, WorkingHours } from '../lib/supabase'
import {
  getAvailableSlots,
  getComboSessionService,
  addWorkingDays,
  getBookingFloor,
  formatPrice,
  formatDuration,
  formatPhone,
  rawPhone,
  formatDateBR,
  buildWhatsAppUrl,
  buildComboWhatsAppUrl,
} from '../lib/utils'
import { syncAppointmentToCalendar } from '../lib/calendar'
import Header from '../components/Header'
import Footer from '../components/Footer'
import Stepper from '../components/Stepper'
import Calendar from '../components/Calendar'
import HorizontalScroller from '../components/HorizontalScroller'
import DiamondDivider from '../components/DiamondDivider'

const STEPS = ['Serviço', 'Data & Hora', 'Seus dados', 'Confirmação']

const DEFAULT_WORKING_HOURS: WorkingHours = {
  monday:    { open: '14:00', close: '20:00', enabled: true },
  tuesday:   { open: '14:00', close: '20:00', enabled: true },
  wednesday: { open: '14:00', close: '20:00', enabled: true },
  thursday:  { open: '14:00', close: '20:00', enabled: true },
  friday:    { open: '14:00', close: '20:00', enabled: true },
  saturday:  { open: '08:00', close: '18:00', enabled: true },
  sunday:    { open: '08:00', close: '18:00', enabled: false },
}

export interface ComboSessionSelection {
  date: Date | null
  time: string | null
}

export default function BookingPage() {
  const navigate = useNavigate()

  // ── Data loading ─────────────────────────────────────────────
  const [services, setServices] = useState<Service[]>([])
  const [combos, setCombos] = useState<Combo[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([])
  const [workingHours, setWorkingHours] = useState<WorkingHours>(DEFAULT_WORKING_HOURS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [svcRes, comboRes, apptRes, blockedRes, settingsRes] = await Promise.all([
        supabase.from('services').select('*').eq('is_active', true).order('name'),
        supabase.from('combos').select('*').eq('is_active', true).order('name'),
        supabase.from('appointments').select('*, service:services(*)').in('status', ['confirmed', 'completed']),
        supabase.from('blocked_slots').select('*').eq('is_active', true),
        supabase.from('settings').select('*').eq('key', 'working_hours').single(),
      ])
      const loadedServices = svcRes.data || []
      setServices(loadedServices)

      if (comboRes.data) {
        // Hydrate service1..service4 for each combo
        const hydrated = comboRes.data.map((c: Combo) => ({
          ...c,
          service1: loadedServices.find(s => s.id === c.service_id_1),
          service2: loadedServices.find(s => s.id === c.service_id_2),
          service3: loadedServices.find(s => s.id === c.service_id_3),
          service4: loadedServices.find(s => s.id === c.service_id_4),
        }))
        setCombos(hydrated)
      }

      if (apptRes.data) setAppointments(apptRes.data as Appointment[])
      if (blockedRes.data) setBlockedSlots(blockedRes.data)
      if (settingsRes.data?.value) setWorkingHours(settingsRes.data.value as WorkingHours)
      setLoading(false)
    }
    load()
  }, [])

  // ── Booking state ─────────────────────────────────────────────
  const [step, setStep] = useState(1)
  const [selectedItemType, setSelectedItemType] = useState<'service' | 'combo'>('service')
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedCombo, setSelectedCombo] = useState<Combo | null>(null)

  // Single appointment state
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)

  // Combo state (4 sessions)
  const [activeSessionIndex, setActiveSessionIndex] = useState<number>(0)
  const [comboSessions, setComboSessions] = useState<ComboSessionSelection[]>([
    { date: null, time: null },
    { date: null, time: null },
    { date: null, time: null },
    { date: null, time: null },
  ])

  // Form state
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [nameError, setNameError] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Step 1 Search & Category filter
  const [step1Category, setStep1Category] = useState<'all' | 'services' | 'combos'>('all')
  const [step1Search, setStep1Search] = useState('')

  // Navigation helpers
  function goNext() { setStep(s => s + 1) }
  function goBack() { setStep(s => s - 1) }

  function handleSelectService(svc: Service) {
    setSelectedItemType('service')
    setSelectedService(svc)
    setSelectedCombo(null)
    setSelectedDate(null)
    setSelectedTime(null)
    goNext()
  }

  function handleSelectCombo(combo: Combo) {
    setSelectedItemType('combo')
    setSelectedCombo(combo)
    setSelectedService(null)
    setComboSessions([
      { date: null, time: null },
      { date: null, time: null },
      { date: null, time: null },
      { date: null, time: null },
    ])
    setActiveSessionIndex(0)
    goNext()
  }

  // Filtered lists for Step 1
  const filteredStep1Services = services.filter(s =>
    s.name.toLowerCase().includes(step1Search.toLowerCase()) ||
    (s.description && s.description.toLowerCase().includes(step1Search.toLowerCase()))
  )

  const filteredStep1Combos = combos.filter(c =>
    c.name.toLowerCase().includes(step1Search.toLowerCase()) ||
    (c.description && c.description.toLowerCase().includes(step1Search.toLowerCase()))
  )

  // ... (rest of code)


  // Single date/time selection
  function selectDate(d: Date) {
    if (selectedItemType === 'service') {
      setSelectedDate(d)
      setSelectedTime(null)
    } else {
      // Combo date selection: editing a session clears any later sessions,
      // since their date/time may no longer respect the sequential order.
      setComboSessions(prev => {
        const next = [...prev]
        next[activeSessionIndex] = { date: d, time: null }
        for (let i = activeSessionIndex + 1; i < next.length; i++) {
          next[i] = { date: null, time: null }
        }
        return next
      })
    }
  }

  function selectTime(t: string) {
    if (selectedItemType === 'service') {
      setSelectedTime(t)
    } else {
      setComboSessions(prev => {
        const next = [...prev]
        next[activeSessionIndex] = { ...next[activeSessionIndex], time: t }
        for (let i = activeSessionIndex + 1; i < next.length; i++) {
          next[i] = { date: null, time: null }
        }
        return next
      })
      // Auto-advance to the next session once the current one is complete
      if (activeSessionIndex < comboSessions.length - 1) {
        setActiveSessionIndex(activeSessionIndex + 1)
      }
    }
  }

  // Combo sessions must be booked in order: session N can't happen before session N-1.
  // A tab is locked until every earlier session has a date and time.
  const firstEmptyComboIndex = comboSessions.findIndex(s => !s.date || !s.time)
  const lastUnlockedComboIndex = firstEmptyComboIndex === -1 ? comboSessions.length - 1 : firstEmptyComboIndex
  function isSessionLocked(idx: number) { return idx > lastUnlockedComboIndex }

  const previousSession = selectedItemType === 'combo' && activeSessionIndex > 0
    ? comboSessions[activeSessionIndex - 1]
    : null

  // Minimum gap between consecutive combo sessions: 5 working days, so a
  // client can't book two sessions right after each other.
  const MIN_SESSION_GAP_DAYS = 5
  const sessionMinDate = previousSession?.date
    ? addWorkingDays(previousSession.date, MIN_SESSION_GAP_DAYS, workingHours, blockedSlots)
    : null

  // All 4 combo sessions must happen within 30 calendar days of the first one.
  const comboWindowStart = selectedItemType === 'combo' ? comboSessions[0].date : null
  const comboMaxDate = comboWindowStart ? addDays(comboWindowStart, 30) : null

  // Compute available slots based on active selection
  const activeDate = selectedItemType === 'service' ? selectedDate : comboSessions[activeSessionIndex].date
  const activeSessionService = selectedItemType === 'combo' && selectedCombo
    ? getComboSessionService(selectedCombo, activeSessionIndex).service
    : undefined
  const activeItem = selectedItemType === 'service' ? selectedService : activeSessionService
  // Combo sessions always keep a minimum gap (sessionMinDate), so a session
  // can never land on the same day as the previous one — no same-day time
  // filtering needed here.
  const slots = activeDate && activeItem
    ? getAvailableSlots(activeDate, activeItem, workingHours, appointments, blockedSlots)
    : []

  // Don't offer today if it has no slots left (already closed, fully booked,
  // or every remaining slot is in the past) — jump to the next working day.
  // For combo sessions after the first, sessionMinDate already wins since
  // it's always further out than today/tomorrow.
  const calendarMinDate = sessionMinDate
    ?? (activeItem ? getBookingFloor(activeItem, workingHours, appointments, blockedSlots) : undefined)

  // Validation
  function validateStep3(): boolean {
    let valid = true
    if (!name.trim() || name.trim().length < 3) {
      setNameError('Informe seu nome completo')
      valid = false
    } else {
      setNameError('')
    }
    const digits = rawPhone(phone)
    if (digits.length < 10) {
      setPhoneError('Informe um telefone celular válido')
      valid = false
    } else {
      setPhoneError('')
    }
    return valid
  }

  // Handle final submission (Single or Combo)
  async function handleConfirm() {
    setSubmitting(true)
    try {
      if (selectedItemType === 'service' && selectedService && selectedDate && selectedTime) {
        const dateStr = format(selectedDate, 'yyyy-MM-dd')
        
        let appt = null
        let error = null

        // Try full payload first
        const fullPayload = {
          service_id: selectedService.id,
          client_name: name.trim(),
          client_phone: rawPhone(phone),
          appointment_date: dateStr,
          appointment_time: selectedTime + ':00',
          status: 'confirmed',
          price: selectedService.price,
          avisado_whatsapp: false,
        }

        const res1 = await supabase
          .from('appointments')
          .insert(fullPayload)
          .select('*, service:services(*)')
          .single()

        if (res1.error) {
          console.warn('[Booking] Full insert failed, trying base payload:', res1.error)
          // Fallback payload without optional columns
          const basePayload = {
            service_id: selectedService.id,
            client_name: name.trim(),
            client_phone: rawPhone(phone),
            appointment_date: dateStr,
            appointment_time: selectedTime + ':00',
            status: 'confirmed',
          }
          const res2 = await supabase
            .from('appointments')
            .insert(basePayload)
            .select('*, service:services(*)')
            .single()

          if (res2.error) {
            error = res2.error
          } else {
            appt = res2.data
          }
        } else {
          appt = res1.data
        }

        if (error || !appt) {
          throw error || new Error('Não foi possível salvar o agendamento.')
        }

        const dateFormatted = formatDateBR(dateStr)
        const cancelUrl = `${window.location.origin}/cancelar/${appt.cancel_token}`
        const waUrl = buildWhatsAppUrl(
          name.trim(),
          selectedService.name,
          dateFormatted,
          selectedTime,
          `A partir de ${formatPrice(selectedService.price)}`,
          cancelUrl
        )

        // Push to Joyce's Google Calendar with a 2h-before reminder
        syncAppointmentToCalendar({
          appointmentId: appt.id,
          clientName: name.trim(),
          clientPhone: phone,
          serviceName: selectedService.name,
          date: dateStr,
          time: selectedTime,
          durationMinutes: selectedService.duration_minutes,
        })

        // Open WhatsApp & redirect to confirmation
        window.open(waUrl, '_blank')
        navigate('/confirmacao', {
          state: {
            appointment: appt,
            service: selectedService,
            dateFormatted,
            time: selectedTime,
            waUrl,
            cancelToken: appt.cancel_token,
            isCombo: false,
          }
        })

      } else if (selectedItemType === 'combo' && selectedCombo) {
        // Combo insert: 4 separate appointments sharing a combo_group_id
        const comboGroupId = crypto.randomUUID()
        const totalPrice = selectedCombo.price
        const baseSessionPrice = Math.floor((totalPrice / 4) * 100) / 100
        const remainder = Math.round((totalPrice - baseSessionPrice * 4) * 100) / 100

        const inserts = comboSessions.map((s, idx) => {
          const dateStr = format(s.date!, 'yyyy-MM-dd')
          const sessionPrice = idx === 3 ? baseSessionPrice + remainder : baseSessionPrice
          const { serviceId } = getComboSessionService(selectedCombo, idx)
          return {
            service_id: serviceId,
            client_name: name.trim(),
            client_phone: rawPhone(phone),
            appointment_date: dateStr,
            appointment_time: s.time + ':00',
            status: 'confirmed',
            price: sessionPrice,
            combo_group_id: comboGroupId,
            combo_session_index: idx + 1,
            combo_name: selectedCombo.name,
            avisado_whatsapp: false,
          }
        })

        let { data: createdAppts, error } = await supabase
          .from('appointments')
          .insert(inserts)
          .select('*')

        if (error) {
          console.warn('[Booking] Combo full insert failed, trying base combo payload:', error)
          const baseInserts = comboSessions.map((s, idx) => ({
            service_id: getComboSessionService(selectedCombo, idx).serviceId,
            client_name: name.trim(),
            client_phone: rawPhone(phone),
            appointment_date: format(s.date!, 'yyyy-MM-dd'),
            appointment_time: s.time + ':00',
            status: 'confirmed',
          }))
          const res2 = await supabase
            .from('appointments')
            .insert(baseInserts)
            .select('*')

          if (res2.error) throw res2.error
          createdAppts = res2.data
        }

        const firstToken = createdAppts && createdAppts.length > 0 ? createdAppts[0].cancel_token : ''
        const comboCancelUrl = firstToken ? `${window.location.origin}/cancelar/${firstToken}` : ''

        // Push each session to Joyce's Google Calendar with 2h-before reminders
        createdAppts?.forEach((created, idx) => {
          const s = comboSessions[idx]
          if (!s.date || !s.time) return
          const { service } = getComboSessionService(selectedCombo, idx)
          syncAppointmentToCalendar({
            appointmentId: created.id,
            clientName: name.trim(),
            clientPhone: phone,
            serviceName: service?.name ?? selectedCombo.name,
            date: format(s.date, 'yyyy-MM-dd'),
            time: s.time,
            durationMinutes: service?.duration_minutes ?? 60,
            notes: `Sessão ${idx + 1} de 4 — ${selectedCombo.name}`,
          })
        })

        const formattedSessions = comboSessions.map((s, idx) => ({
          sessionIndex: idx + 1,
          dateFormatted: formatDateBR(format(s.date!, 'yyyy-MM-dd')),
          time: s.time!,
          price: idx === 3 ? baseSessionPrice + remainder : baseSessionPrice,
          serviceName: getComboSessionService(selectedCombo, idx).service?.name,
        }))

        const waUrl = buildComboWhatsAppUrl(
          name.trim(),
          selectedCombo.name,
          formattedSessions.map(f => ({ date: f.dateFormatted, time: f.time, serviceName: f.serviceName })),
          formatPrice(totalPrice),
          comboCancelUrl
        )

        // Open WhatsApp & redirect to confirmation
        window.open(waUrl, '_blank')
        navigate('/confirmacao', {
          state: {
            combo: selectedCombo,
            comboSessions: formattedSessions,
            totalPrice,
            waUrl,
            cancelToken: createdAppts && createdAppts.length > 0 ? createdAppts[0].cancel_token : '',
            comboGroupId,
            isCombo: true,
          }
        })
      }
    } catch (err: any) {
      console.error(err)
      alert(`Erro ao salvar agendamento: ${err?.message || 'Tente novamente.'}`)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <>
        <Header />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <div className="spinner" />
        </div>
      </>
    )
  }

  const isComboComplete = comboSessions.every(s => s.date !== null && s.time !== null)

  return (
    <>
      <Header />
      <div style={{ padding: '3rem 1.25rem 5rem', minHeight: '80vh' }}>
        <div className="container">
          <h1 className="page-title animate-in">Agendar Horário</h1>
          <p className="page-subtitle animate-in">
            {step === 1 && 'Escolha um serviço avulso ou pacote combo'}
            {step === 2 && (selectedItemType === 'service' ? 'Selecione a data e o horário' : 'Escolha as datas das 4 sessões do combo')}
            {step === 3 && 'Preencha seus dados de contato'}
            {step === 4 && 'Revise e confirme seu agendamento'}
          </p>

          <Stepper currentStep={step} steps={STEPS} />
          <DiamondDivider />

          {/* ── Step 1: Services or Combos Selection ── */}
          {step === 1 && (
            <div className="animate-in">

              {/* Filter controls */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem' }}>
                {/* Category Pills */}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    className={`session-tab${step1Category === 'all' ? ' session-tab--active' : ''}`}
                    onClick={() => setStep1Category('all')}
                  >
                    Todos os itens ({filteredStep1Services.length + filteredStep1Combos.length})
                  </button>
                  <button
                    className={`session-tab${step1Category === 'services' ? ' session-tab--active' : ''}`}
                    onClick={() => setStep1Category('services')}
                  >
                    Serviços Avulsos ({filteredStep1Services.length})
                  </button>
                  {combos.length > 0 && (
                    <button
                      className={`session-tab${step1Category === 'combos' ? ' session-tab--active' : ''}`}
                      onClick={() => setStep1Category('combos')}
                    >
                      Combos 4 Sessões ({filteredStep1Combos.length})
                    </button>
                  )}
                </div>

                {/* Search Box */}
                <div style={{ flex: 1, minWidth: '220px', maxWidth: '300px' }}>
                  <input
                    type="text"
                    className="input"
                    style={{ padding: '0.5rem 0.85rem', fontSize: '0.9rem' }}
                    placeholder="🔍 Buscar serviço ou combo..."
                    value={step1Search}
                    onChange={e => setStep1Search(e.target.value)}
                  />
                </div>
              </div>

              {/* Combos Section */}
              {(step1Category === 'all' || step1Category === 'combos') && filteredStep1Combos.length > 0 && (
                <div style={{ marginBottom: '2.5rem' }}>
                  <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.3rem', marginBottom: '0.4rem' }}>
                    Combos (Pacotes de 4 Sessões)
                  </h2>
                  <p style={{ fontSize: '0.9rem', color: 'var(--color-black)', marginBottom: '1rem' }}>
                    Pacotes de 4 sessões, cada uma com seu próprio serviço, válidos por 30 dias com datas e horários livres.
                  </p>

                  <div style={{ display: 'grid', gap: '1rem' }}>
                    {filteredStep1Combos.map(combo => {
                      const sessionServices = [combo.service1, combo.service2, combo.service3, combo.service4]
                      const totalDuration = sessionServices.reduce((sum, s) => sum + (s?.duration_minutes ?? 60), 0)
                      return (
                        <div
                          key={combo.id}
                          className={`card card--hoverable card--combo${selectedCombo?.id === combo.id ? ' card--selected' : ''}`}
                          onClick={() => handleSelectCombo(combo)}
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                              <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1.15rem', fontWeight: 600 }}>
                                {combo.name}
                              </span>
                              <span className="badge badge--combo">4 sessões</span>
                            </div>
                            <div style={{ fontSize: '0.9rem', color: 'var(--color-black)' }}>
                              {sessionServices.map((s, idx) => (
                                <span key={idx}>
                                  <strong>Sessão {idx + 1}:</strong> {s?.name}{idx < 3 ? ' · ' : ''}
                                </span>
                              ))}
                            </div>
                            <div style={{ fontSize: '0.82rem', color: 'var(--color-black)', marginTop: '0.3rem' }}>
                              ⏱ Duração total do pacote: {formatDuration(totalDuration)}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontFamily: 'var(--font-elegant)', fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-black)', fontWeight: 600 }}>
                              Preço Total (4 sessões)
                            </div>
                            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.4rem', fontWeight: 600 }}>
                              {formatPrice(combo.price)}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Individual Services Section */}
              {(step1Category === 'all' || step1Category === 'services') && (
                <div>
                  <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.3rem', marginBottom: '0.4rem' }}>
                    Serviços Avulsos
                  </h2>
                  <p style={{ fontSize: '0.9rem', color: 'var(--color-black)', marginBottom: '1rem' }}>
                    Agendamentos individuais por sessão.
                  </p>

                  {filteredStep1Services.length === 0 ? (
                    <p style={{ fontStyle: 'italic', padding: '1.5rem 0', textAlign: 'center' }}>
                      Nenhum serviço avulso encontrado para "{step1Search}".
                    </p>
                  ) : (
                    <HorizontalScroller>
                      {filteredStep1Services.map(svc => (
                        <div
                          key={svc.id}
                          className={`card card--hoverable h-scroll__item${selectedService?.id === svc.id ? ' card--selected' : ''}`}
                          onClick={() => handleSelectService(svc)}
                        >
                          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 600 }}>
                            {svc.name}
                          </div>
                          {svc.description && (
                            <div className="h-scroll__desc" style={{ fontSize: '0.9rem', color: 'var(--color-black)' }}>
                              {svc.description}
                            </div>
                          )}
                          <div style={{ fontSize: '0.82rem', color: 'var(--color-black)' }}>
                            ⏱ {formatDuration(svc.duration_minutes)}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', paddingTop: '0.4rem', borderTop: '1px solid var(--color-border)' }}>
                            A partir de <strong style={{ color: 'var(--color-black)' }}>{formatPrice(svc.price)}</strong>
                          </div>
                        </div>
                      ))}
                    </HorizontalScroller>
                  )}
                </div>
              )}

            </div>
          )}

          {/* ── Step 2: Date & Time ── */}
          {step === 2 && (
            <div className="animate-in">

              {/* Info banner */}
              <div className="notice-box">
                <span style={{ fontWeight: 600 }}>Item selecionado: </span>
                {selectedItemType === 'service' ? (
                  <span>{selectedService?.name} (A partir de {formatPrice(selectedService?.price || 0)})</span>
                ) : (
                  <span>Combo {selectedCombo?.name} (Total: {formatPrice(selectedCombo?.price || 0)})</span>
                )}
              </div>

              {/* If Combo: Session Tabs Selector */}
              {selectedItemType === 'combo' && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <p style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                    Escolha a data e horário de cada sessão, em ordem (próximos 30 dias):
                  </p>
                  <div className="session-tabs">
                    {comboSessions.map((s, idx) => {
                      const isFilled = s.date !== null && s.time !== null
                      const isActive = activeSessionIndex === idx
                      const locked = isSessionLocked(idx)
                      const sessionServiceName = selectedCombo ? getComboSessionService(selectedCombo, idx).service?.name : ''
                      return (
                        <button
                          key={idx}
                          className={`session-tab${isActive ? ' session-tab--active' : ''}${isFilled ? ' session-tab--filled' : ''}${locked ? ' session-tab--locked' : ''}`}
                          onClick={() => !locked && setActiveSessionIndex(idx)}
                          disabled={locked}
                        >
                          {locked ? '🔒 ' : ''}Sessão {idx + 1} · {sessionServiceName} {isFilled ? `✓ (${formatDateBR(format(s.date!, 'yyyy-MM-dd'))} ${s.time})` : ''}
                        </button>
                      )
                    })}
                  </div>
                  {activeSessionService && (
                    <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginTop: '0.5rem' }}>
                      Agendando a <strong>Sessão {activeSessionIndex + 1}</strong>: {activeSessionService.name} ({formatDuration(activeSessionService.duration_minutes)})
                    </p>
                  )}
                  {sessionMinDate && (
                    <p style={{ fontSize: '0.82rem', color: 'var(--color-muted)', marginTop: '0.25rem' }}>
                      Esta sessão só pode ser marcada a partir de {formatDateBR(format(sessionMinDate, 'yyyy-MM-dd'))} (mínimo de {MIN_SESSION_GAP_DAYS} dias úteis após a sessão anterior).
                    </p>
                  )}
                  {comboMaxDate && activeSessionIndex > 0 && (
                    <p style={{ fontSize: '0.82rem', color: 'var(--color-muted)', marginTop: '0.25rem' }}>
                      As 4 sessões precisam ser marcadas até {formatDateBR(format(comboMaxDate, 'yyyy-MM-dd'))} (30 dias após a Sessão 1).
                    </p>
                  )}
                </div>
              )}

              {/* Calendar */}
              <Calendar
                key={selectedItemType === 'combo' ? activeSessionIndex : 'service'}
                selected={activeDate}
                onSelect={selectDate}
                workingHours={workingHours}
                blockedSlots={blockedSlots}
                minDate={calendarMinDate}
                maxDate={selectedItemType === 'combo' && activeSessionIndex > 0 ? comboMaxDate : undefined}
              />

              {activeDate && (
                <div style={{ marginTop: '1.5rem' }} className="animate-in">
                  <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-black)', marginBottom: '0.5rem' }}>
                    {format(activeDate, "EEEE, d 'de' MMMM", { locale: ptBR })} — horários disponíveis
                  </p>

                  {slots.length === 0 ? (
                    <p style={{ color: '#8B0000', fontStyle: 'italic', padding: '1rem 0' }}>
                      Nenhum horário disponível nesta data. Tente outro dia.
                    </p>
                  ) : (
                    <div className="slots-grid">
                      {slots.map(slot => (
                        <div
                          key={slot}
                          className={`slot${(selectedItemType === 'service' ? selectedTime === slot : comboSessions[activeSessionIndex].time === slot) ? ' slot--selected' : ''}`}
                          onClick={() => selectTime(slot)}
                        >
                          {slot}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Step 2 Actions */}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '2rem' }}>
                <button className="btn btn--ghost" onClick={goBack}>← Voltar</button>
                <button
                  className="btn"
                  onClick={goNext}
                  disabled={selectedItemType === 'service' ? (!selectedDate || !selectedTime) : !isComboComplete}
                  style={{ flex: 1 }}
                >
                  {selectedItemType === 'combo' && !isComboComplete
                    ? `Preencha as 4 sessões (${comboSessions.filter(s => s.date && s.time).length}/4)`
                    : 'Continuar →'}
                </button>
              </div>

            </div>
          )}

          {/* ── Step 3: Client data ── */}
          {step === 3 && (
            <div className="animate-in" style={{ maxWidth: '440px', margin: '0 auto' }}>
              <div className="field">
                <label className="label" htmlFor="client-name">Nome completo *</label>
                <input
                  id="client-name"
                  className={`input${nameError ? ' input--error' : ''}`}
                  type="text"
                  placeholder="Seu nome completo"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  autoComplete="name"
                />
                {nameError && <span className="input-error-msg">{nameError}</span>}
              </div>

              <div className="field">
                <label className="label" htmlFor="client-phone">WhatsApp / Telefone Celular *</label>
                <input
                  id="client-phone"
                  className={`input${phoneError ? ' input--error' : ''}`}
                  type="tel"
                  placeholder="(11) 99999-9999"
                  value={phone}
                  onChange={e => setPhone(formatPhone(e.target.value))}
                  inputMode="numeric"
                />
                {phoneError && <span className="input-error-msg">{phoneError}</span>}
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button className="btn btn--ghost" onClick={goBack}>← Voltar</button>
                <button
                  className="btn"
                  style={{ flex: 1 }}
                  onClick={() => { if (validateStep3()) goNext() }}
                >
                  Continuar →
                </button>
              </div>
            </div>
          )}

          {/* ── Step 4: Summary & Confirmation ── */}
          {step === 4 && (
            <div className="animate-in" style={{ maxWidth: '520px', margin: '0 auto' }}>
              <div className="card" style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', marginBottom: '1.25rem' }}>
                  Resumo do agendamento
                </h3>

                {selectedItemType === 'service' && selectedService && selectedDate && selectedTime && (
                  <>
                    {[
                      { label: 'Serviço', value: selectedService.name },
                      { label: 'Data', value: format(selectedDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR }) },
                      { label: 'Horário', value: selectedTime },
                      { label: 'Duração', value: formatDuration(selectedService.duration_minutes) },
                      { label: 'Valor', value: `A partir de ${formatPrice(selectedService.price)}` },
                      { label: 'Nome', value: name },
                      { label: 'Telefone', value: phone },
                    ].map(row => (
                      <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '0.6rem 0', borderBottom: '1px solid var(--color-border)', gap: '1rem' }}>
                        <span style={{ fontFamily: 'var(--font-elegant)', fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-black)', flexShrink: 0 }}>
                          {row.label}
                        </span>
                        <span style={{ fontSize: '0.95rem', textAlign: 'right', fontWeight: 500 }}>
                          {row.value}
                        </span>
                      </div>
                    ))}
                  </>
                )}

                {selectedItemType === 'combo' && selectedCombo && (
                  <>
                    <div style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--color-border)', marginBottom: '0.5rem' }}>
                      <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 600 }}>
                        {selectedCombo.name} (4 sessões)
                      </span>
                    </div>

                    {comboSessions.map((s, idx) => {
                      const dateStr = formatDateBR(format(s.date!, 'yyyy-MM-dd'))
                      const sessionPrice = selectedCombo.price / 4
                      const serviceName = getComboSessionService(selectedCombo, idx).service?.name
                      return (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px dashed var(--color-border)', fontSize: '0.9rem' }}>
                          <span><strong>Sessão {idx + 1} ({serviceName}):</strong> {dateStr} às {s.time}</span>
                          <span>{formatPrice(sessionPrice)}</span>
                        </div>
                      )
                    })}

                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', marginTop: '0.5rem', fontWeight: 700, fontSize: '1.1rem' }}>
                      <span>Total Geral:</span>
                      <span>{formatPrice(selectedCombo.price)}</span>
                    </div>
                  </>
                )}
              </div>

              <div className="notice-box">
                ✨ Ao clicar no botão abaixo, seu horário será confirmado imediatamente e você será redirecionada ao WhatsApp da Joyce.
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn btn--ghost" onClick={goBack} disabled={submitting}>← Voltar</button>
                <button
                  className="btn btn--filled"
                  style={{ flex: 1 }}
                  onClick={handleConfirm}
                  disabled={submitting}
                >
                  {submitting ? 'Salvando...' : '✓ Confirmar agendamento'}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
      <Footer />
    </>
  )
}
