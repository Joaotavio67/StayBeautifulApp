import { useLocation, Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Header from '../components/Header'
import Footer from '../components/Footer'
import DiamondDivider from '../components/DiamondDivider'
import { supabase } from '../lib/supabase'
import type { Appointment, Service, Combo } from '../lib/supabase'
import { formatPrice } from '../lib/utils'

interface ConfirmationState {
  appointment?: Appointment
  service?: Service
  dateFormatted?: string
  time?: string
  waUrl: string
  cancelToken: string
  isCombo?: boolean
  combo?: Combo
  comboSessions?: { sessionIndex: number; dateFormatted: string; time: string; price: number; serviceName?: string }[]
  totalPrice?: number
  comboGroupId?: string
}

export default function ConfirmationPage() {
  const location = useLocation()
  const state = location.state as ConfirmationState | undefined

  const [avisado, setAvisado] = useState(false)
  const [loadingAvisado, setLoadingAvisado] = useState(false)

  useEffect(() => {
    if (!state) return
    const { appointment, comboGroupId } = state

    // Check DB status for avisado_whatsapp
    async function checkAvisado() {
      if (comboGroupId) {
        const { data } = await supabase
          .from('appointments')
          .select('avisado_whatsapp')
          .eq('combo_group_id', comboGroupId)
          .limit(1)
        if (data && data.length > 0 && data[0].avisado_whatsapp) {
          setAvisado(true)
        }
      } else if (appointment?.id) {
        const { data } = await supabase
          .from('appointments')
          .select('avisado_whatsapp')
          .eq('id', appointment.id)
          .single()
        if (data?.avisado_whatsapp) {
          setAvisado(true)
        }
      }
    }
    checkAvisado()
  }, [state])

  if (!state) {
    return (
      <>
        <Header />
        <div style={{ textAlign: 'center', padding: '5rem 1.25rem' }}>
          <p style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', marginBottom: '1rem' }}>
            Nenhum agendamento encontrado.
          </p>
          <Link to="/agendar" className="btn">Fazer agendamento</Link>
        </div>
        <Footer />
      </>
    )
  }

  const { service, dateFormatted, time, waUrl, cancelToken, isCombo, combo, comboSessions, totalPrice, comboGroupId } = state

  async function handleWhatsAppClick() {
    setLoadingAvisado(true)
    try {
      if (comboGroupId) {
        await supabase
          .from('appointments')
          .update({ avisado_whatsapp: true })
          .eq('combo_group_id', comboGroupId)
      } else if (state?.appointment?.id) {
        await supabase
          .from('appointments')
          .update({ avisado_whatsapp: true })
          .eq('id', state.appointment.id)
      }
      setAvisado(true)
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingAvisado(false)
    }

    // Open WhatsApp
    window.open(waUrl, '_blank')
  }

  return (
    <>
      <Header />
      <div style={{ padding: '4rem 1.25rem 6rem', minHeight: '80vh' }}>
        <div className="container" style={{ maxWidth: '540px', textAlign: 'center' }}>

          <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>✨</div>

          <h1 className="page-title animate-in">Agendado!</h1>
          <p className="page-subtitle animate-in">Seu horário está confirmado</p>

          <DiamondDivider />

          <div className="card animate-in" style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', marginBottom: '1.25rem', textAlign: 'center', fontWeight: 600 }}>
              {isCombo ? `Combo ${combo?.name}` : `Nos vemos em ${dateFormatted} às ${time} 🖤`}
            </h2>

            {!isCombo && service && (
              <>
                {[
                  { label: 'Serviço', value: service.name },
                  { label: 'Data', value: dateFormatted! },
                  { label: 'Horário', value: time! },
                  { label: 'Valor', value: `A partir de ${formatPrice(service.price)}` },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: '1px solid var(--color-border)', gap: '1rem' }}>
                    <span style={{ fontFamily: 'var(--font-elegant)', fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-black)' }}>
                      {row.label}
                    </span>
                    <span style={{ fontSize: '0.95rem', textAlign: 'right', fontWeight: 500 }}>{row.value}</span>
                  </div>
                ))}
              </>
            )}

            {isCombo && comboSessions && (
              <>
                <p style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                  Datas agendadas para o pacote:
                </p>
                {comboSessions.map(s => (
                  <div key={s.sessionIndex} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px dashed var(--color-border)', fontSize: '0.9rem' }}>
                    <span><strong>Sessão {s.sessionIndex}{s.serviceName ? ` (${s.serviceName})` : ''}:</strong> {s.dateFormatted} às {s.time}</span>
                    <span>{formatPrice(s.price)}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', marginTop: '0.5rem', fontWeight: 700, fontSize: '1.1rem' }}>
                  <span>Total Geral:</span>
                  <span>{formatPrice(totalPrice || 0)}</span>
                </div>
              </>
            )}
          </div>

          <p className="info-text" style={{ marginBottom: '1.5rem' }}>
            Se a janela do WhatsApp não abriu automaticamente, clique no botão abaixo para avisar a Joyce sobre seu agendamento.
          </p>

          <button
            onClick={handleWhatsAppClick}
            disabled={loadingAvisado}
            className={`btn btn--full ${avisado ? 'btn--whatsapp-sent' : 'btn--filled'}`}
            style={{ marginBottom: '0.75rem', padding: '0.85rem 1.25rem' }}
          >
            {avisado ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#a5d6a7' }}>
                  ✓ Joyce já foi avisada
                </span>
                <span style={{ fontSize: '0.78rem', opacity: 0.9, fontWeight: 400, textTransform: 'none', letterSpacing: 'normal' }}>
                  Clique aqui para avisar novamente via WhatsApp
                </span>
              </div>
            ) : (
              <span>💬 Avisar a Joyce pelo WhatsApp</span>
            )}
          </button>

          <DiamondDivider />

          <div style={{ fontSize: '0.9rem', color: 'var(--color-black)', lineHeight: '1.6' }}>
            <p>Precisa cancelar ou reagendar? Use o link exclusivo abaixo (sem precisar de login).</p>
            <Link
              to={`/cancelar/${cancelToken}`}
              style={{ fontFamily: 'var(--font-elegant)', fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-black)', textDecoration: 'underline', marginTop: '0.5rem', display: 'inline-block' }}
            >
              Cancelar ou reagendar meu agendamento
            </Link>
          </div>

          <div style={{ marginTop: '2rem' }}>
            <Link to="/" className="btn btn--ghost">← Voltar ao início</Link>
          </div>
        </div>
      </div>
      <Footer />
    </>
  )
}
