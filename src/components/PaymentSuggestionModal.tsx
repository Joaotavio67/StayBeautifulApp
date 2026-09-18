import { useState } from 'react'
import type { Service, Appointment } from '../lib/supabase'
import { formatPrice } from '../lib/utils'

interface PaymentSuggestionModalProps {
  appointment: Appointment
  service?: Service
  dateFormatted: string
  time: string
  onPaymentSuccess: () => void
  onSkip: () => void
  isOpen: boolean
}

export default function PaymentSuggestionModal({
  appointment,
  service,
  dateFormatted,
  time,
  onPaymentSuccess,
  onSkip,
  isOpen,
}: PaymentSuggestionModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  const price = appointment.price ?? service?.price ?? 0

  async function handlePayNow() {
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/create-payment-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId: appointment.id,
          clientName: appointment.client_name,
          serviceName: service?.name || 'Agendamento',
          price: price,
          appointmentDate: appointment.appointment_date,
          appointmentTime: time,
        }),
      })

      if (!response.ok) {
        throw new Error('Falha ao processar pagamento')
      }

      const data = await response.json()
      if (data.init_point) {
        // Redirect to Mercado Pago checkout
        window.location.href = data.init_point
        onPaymentSuccess()
      } else {
        throw new Error('Link de pagamento não disponível')
      }
    } catch (err: any) {
      console.error('Payment error:', err)
      setError(err.message || 'Erro ao iniciar pagamento. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) onSkip()
      }}
    >
      <div className="modal" style={{ maxWidth: '480px' }}>
        <h2 className="modal__title" style={{ marginBottom: '1rem' }}>
          💳 Adiantar o pagamento?
        </h2>

        <p
          style={{
            fontSize: '0.95rem',
            color: 'var(--color-black)',
            marginBottom: '1.5rem',
            lineHeight: '1.5',
          }}
        >
          Você pode pagar agora via Pix ou cartão de crédito. Pode também pagar na hora do atendimento.
        </p>

        {/* Appointment summary */}
        <div
          style={{
            backgroundColor: 'var(--color-bg-light)',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1.5rem',
            borderLeft: '4px solid var(--color-primary)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.9rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600, fontFamily: 'var(--font-elegant)', letterSpacing: '0.05em' }}>
                SERVIÇO
              </span>
              <span>{service?.name || 'Agendamento'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600, fontFamily: 'var(--font-elegant)', letterSpacing: '0.05em' }}>
                DATA
              </span>
              <span>{dateFormatted}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600, fontFamily: 'var(--font-elegant)', letterSpacing: '0.05em' }}>
                HORÁRIO
              </span>
              <span>{time}</span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                paddingTop: '0.6rem',
                borderTop: '1px solid var(--color-border)',
                marginTop: '0.6rem',
                fontWeight: 700,
                fontSize: '1rem',
              }}
            >
              <span style={{ fontFamily: 'var(--font-elegant)', letterSpacing: '0.05em' }}>VALOR</span>
              <span>{formatPrice(price)}</span>
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div
            style={{
              backgroundColor: '#ffebee',
              color: '#c62828',
              padding: '0.75rem',
              borderRadius: '6px',
              fontSize: '0.85rem',
              marginBottom: '1rem',
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {/* Action buttons */}
        <div className="modal__actions" style={{ gap: '0.75rem' }}>
          <button className="btn btn--ghost" onClick={onSkip} disabled={isLoading}>
            Pagar no salão
          </button>
          <button
            className="btn btn--filled"
            onClick={handlePayNow}
            disabled={isLoading}
            style={{
              backgroundColor: isLoading ? 'var(--color-disabled)' : 'var(--color-primary)',
            }}
          >
            {isLoading ? 'Processando...' : '💳 Pagar agora'}
          </button>
        </div>
      </div>
    </div>
  )
}
