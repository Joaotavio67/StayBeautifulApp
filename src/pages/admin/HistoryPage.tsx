import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import type { Appointment, Service } from '../../lib/supabase'
import { formatDateBR, formatPrice } from '../../lib/utils'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type AppointmentWithService = Appointment & { service?: Service }

export default function AdminHistoryPage() {
  const [appointments, setAppointments] = useState<AppointmentWithService[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>('')

  async function loadHistory() {
    const { data } = await supabase
      .from('appointments')
      .select('*, service:services(*)')
      .eq('status', 'completed')
      .order('appointment_date', { ascending: false })
      .order('appointment_time', { ascending: false })

    if (data) {
      setAppointments(data as AppointmentWithService[])
      // Default to current month key "YYYY-MM" if available, else first item's month
      const nowStr = format(new Date(), 'yyyy-MM')
      if (data.length > 0) {
        const months = Array.from(
          new Set(data.map((a) => format(parseISO(a.appointment_date), 'yyyy-MM')))
        )
        if (months.includes(nowStr)) {
          setSelectedMonthKey(nowStr)
        } else {
          setSelectedMonthKey(months[0])
        }
      } else {
        setSelectedMonthKey(nowStr)
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    loadHistory()
  }, [])

  // Group unique months available in completed list
  const availableMonths = Array.from(
    new Set([
      format(new Date(), 'yyyy-MM'),
      ...appointments.map((a) => format(parseISO(a.appointment_date), 'yyyy-MM')),
    ])
  ).sort((a, b) => b.localeCompare(a))

  // Filter appointments for selected month
  const monthAppointments = appointments.filter(
    (a) => format(parseISO(a.appointment_date), 'yyyy-MM') === selectedMonthKey
  )

  // Calculate monthly total
  const monthTotal = monthAppointments.reduce((sum, a) => {
    const p = a.price ?? a.service?.price ?? 0
    return sum + Number(p)
  }, 0)

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem' }}>
            Histórico de Concluídos
          </h1>
          <p style={{ color: 'var(--color-black)', fontSize: '0.9rem' }}>
            Agendamentos marcados como concluídos e faturamento mensal
          </p>
        </div>

        {/* Month selector */}
        <div>
          <label className="label" style={{ marginBottom: '0.2rem', display: 'block' }}>
            Mês / Ano
          </label>
          <select
            className="input"
            style={{ width: 'auto', padding: '0.5rem 1rem' }}
            value={selectedMonthKey}
            onChange={(e) => setSelectedMonthKey(e.target.value)}
          >
            {availableMonths.map((mKey) => {
              const [y, m] = mKey.split('-').map(Number)
              const d = new Date(y, m - 1, 1)
              return (
                <option key={mKey} value={mKey}>
                  {format(d, "MMMM 'de' yyyy", { locale: ptBR })}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Monthly Total Box */}
      <div
        className="card"
        style={{
          marginBottom: '1.5rem',
          background: 'var(--color-black)',
          color: 'var(--color-white)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div
            style={{
              fontFamily: 'var(--font-elegant)',
              fontSize: '0.85rem',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              opacity: 0.8,
            }}
          >
            Total recebido em{' '}
            {selectedMonthKey ? format(parseISO(`${selectedMonthKey}-01`), "MMMM 'de' yyyy", { locale: ptBR }) : ''}
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '2.25rem', fontWeight: 600 }}>
            {formatPrice(monthTotal)}
          </div>
        </div>
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.9rem',
            opacity: 0.8,
            textAlign: 'right',
          }}
        >
          {monthAppointments.length} atendimentos concluídos
        </div>
      </div>

      {loading && <div className="spinner" />}

      {!loading && monthAppointments.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-black)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>📂</div>
          <p style={{ fontStyle: 'italic', fontSize: '1rem' }}>
            Nenhum atendimento concluído neste mês.
          </p>
        </div>
      )}

      {monthAppointments.map((appt) => {
        const itemPrice = appt.price ?? appt.service?.price ?? 0
        const isCombo = Boolean(appt.combo_group_id)

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
                <div>
                  📅 {formatDateBR(appt.appointment_date)} às {appt.appointment_time.slice(0, 5)}
                </div>
                <div>💰 {formatPrice(itemPrice)}</div>
              </div>
            </div>
            <div className="appt-card__actions">
              <span className="badge badge--completed">Concluído</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
