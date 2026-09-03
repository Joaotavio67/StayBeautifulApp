import { useParams, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Appointment, Service } from '../lib/supabase'
import { formatDateBR, formatPrice } from '../lib/utils'
import { removeCalendarEventForAppointment, removeCalendarEventsForComboGroup } from '../lib/calendar'
import Header from '../components/Header'
import Footer from '../components/Footer'
import DiamondDivider from '../components/DiamondDivider'

type AppointmentWithService = Appointment & { service?: Service }

export default function CancelPage() {
  const { token } = useParams<{ token: string }>()
  const [appt, setAppt] = useState<AppointmentWithService | null>(null)
  const [loading, setLoading] = useState(true)
  const [cancelledMode, setCancelledMode] = useState<'single' | 'all' | null>(null)
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (!token) return
    supabase
      .from('appointments')
      .select('*, service:services(*)')
      .eq('cancel_token', token)
      .eq('status', 'confirmed')
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (err || !data) setError('Agendamento não encontrado ou já cancelado.')
        else setAppt(data as AppointmentWithService)
        setLoading(false)
      })
  }, [token])

  async function handleCancelSingle() {
    if (!appt) return
    setConfirming(true)
    const { error: err } = await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', appt.id)
    if (err) {
      setError('Erro ao cancelar. Tente novamente.')
    } else {
      removeCalendarEventForAppointment(appt.id)
      setCancelledMode('single')
    }
    setConfirming(false)
  }

  async function handleCancelEntireCombo() {
    if (!appt || !appt.combo_group_id) return
    if (!confirm('Tem certeza que deseja cancelar TODAS as 4 sessões deste combo?')) return
    setConfirming(true)
    const { error: err } = await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('combo_group_id', appt.combo_group_id)

    if (err) {
      setError('Erro ao cancelar o combo. Tente novamente.')
    } else {
      removeCalendarEventsForComboGroup(appt.combo_group_id)
      setCancelledMode('all')
    }
    setConfirming(false)
  }

  const isCombo = Boolean(appt?.combo_group_id)

  return (
    <>
      <Header />
      <div style={{ padding: '4rem 1.25rem 6rem', minHeight: '80vh' }}>
        <div className="container" style={{ maxWidth: '500px', textAlign: 'center' }}>

          {loading && <div className="spinner" />}

          {!loading && error && (
            <>
              <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>⚠️</div>
              <h1 className="page-title" style={{ fontSize: '2.5rem' }}>Ops...</h1>
              <p className="info-text" style={{ marginTop: '0.5rem' }}>{error}</p>
              <DiamondDivider />
              <Link to="/" className="btn">← Voltar ao início</Link>
            </>
          )}

          {!loading && !error && cancelledMode && (
            <>
              <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>✓</div>
              <h1 className="page-title" style={{ fontSize: '2.5rem' }}>Cancelado!</h1>
              <p className="info-text" style={{ marginTop: '0.5rem' }}>
                {cancelledMode === 'all'
                  ? 'Todas as sessões deste combo foram canceladas e os horários liberados.'
                  : 'Seu agendamento foi cancelado e o horário liberado para outras clientes.'}
              </p>
              <DiamondDivider />
              <Link to="/agendar" className="btn">Fazer novo agendamento</Link>
            </>
          )}

          {!loading && !error && !cancelledMode && appt && (
            <>
              <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🗓️</div>
              <h1 className="page-title" style={{ fontSize: '2.5rem' }}>Cancelar</h1>
              <p className="page-subtitle">agendamento</p>

              <DiamondDivider />

              <div className="card" style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
                {isCombo && (
                  <div style={{ marginBottom: '0.75rem', textAlign: 'center' }}>
                    <span className="badge badge--combo" style={{ fontSize: '0.85rem' }}>
                      {appt.combo_name || 'Combo'} · Sessão {appt.combo_session_index} de 4
                    </span>
                  </div>
                )}

                {[
                  { label: isCombo ? 'Pacote / Serviço' : 'Serviço', value: isCombo ? appt.combo_name : appt.service?.name },
                  { label: 'Data', value: formatDateBR(appt.appointment_date) },
                  { label: 'Horário', value: appt.appointment_time.slice(0, 5) },
                  { label: 'Valor', value: formatPrice(appt.price ?? appt.service?.price ?? 0) },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: '1px solid var(--color-border)', gap: '1rem' }}>
                    <span style={{ fontFamily: 'var(--font-elegant)', fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-black)' }}>
                      {row.label}
                    </span>
                    <span style={{ fontSize: '0.95rem', textAlign: 'right', fontWeight: 500 }}>{row.value}</span>
                  </div>
                ))}
              </div>

              <div className="notice-box">
                Tem certeza que deseja cancelar? O horário selecionado ficará imediatamente disponível para outras clientes.
              </div>

              {isCombo ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <button
                    className="btn btn--danger"
                    onClick={handleCancelSingle}
                    disabled={confirming}
                  >
                    {confirming ? 'Cancelando...' : `Cancelar apenas a Sessão ${appt.combo_session_index}`}
                  </button>
                  <button
                    className="btn btn--danger"
                    style={{ background: '#5a1010', color: '#fff', borderColor: '#5a1010' }}
                    onClick={handleCancelEntireCombo}
                    disabled={confirming}
                  >
                    {confirming ? 'Cancelando...' : 'Cancelar o Combo Inteiro (todas as 4 sessões)'}
                  </button>
                  <Link to="/" className="btn btn--ghost" style={{ marginTop: '0.5rem' }}>
                    ← Manter agendamento
                  </Link>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <Link to="/" className="btn btn--ghost" style={{ flex: 1, justifyContent: 'center' }}>← Voltar</Link>
                  <button
                    className="btn btn--danger"
                    style={{ flex: 1 }}
                    onClick={handleCancelSingle}
                    disabled={confirming}
                  >
                    {confirming ? 'Cancelando...' : 'Confirmar cancelamento'}
                  </button>
                </div>
              )}
            </>
          )}

        </div>
      </div>
      <Footer />
    </>
  )
}
