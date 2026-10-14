import { Link } from 'react-router-dom'
import Header from '../components/Header'
import Footer from '../components/Footer'
import DiamondDivider from '../components/DiamondDivider'
import { useSalonInfo, formatHoursLines } from '../lib/salonInfo'

export default function HomePage() {
  const { info, hours } = useSalonInfo()

  return (
    <>
      <Header />

      {/* Hero */}
      <section style={{ minHeight: '88vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '4rem 1.25rem' }}>
        <p
          className="animate-in"
          style={{
            fontFamily: 'var(--font-elegant)',
            fontSize: '0.9rem',
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: '#111111',
            marginBottom: '0.75rem',
            animationDelay: '0.1s',
          }}
        >
          {info.professional} · Cabeleireira · +8 anos de experiência
        </p>

        <h1 className="page-title animate-in" style={{ animationDelay: '0.2s', fontSize: 'clamp(3.8rem, 12vw, 7.5rem)', color: '#111111' }}>
          Stay Beautiful
        </h1>

        <p
          className="animate-in"
          style={{
            fontFamily: 'var(--font-elegant)',
            fontSize: '1.25rem',
            fontWeight: 600,
            color: '#111111',
            maxWidth: '500px',
            marginTop: '1rem',
            animationDelay: '0.3s'
          }}
        >
          Beleza com elegância, em Pirapora do Bom Jesus.
        </p>

        <DiamondDivider />

        <Link
          to="/agendar"
          className="btn btn--filled animate-in"
          style={{
            animationDelay: '0.5s',
            padding: '1rem 3.25rem',
            fontSize: '0.9rem',
            letterSpacing: '0.16em',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          Agendar Horário
        </Link>

        <p
          className="animate-in"
          style={{
            marginTop: '1.25rem',
            fontSize: '0.88rem',
            fontWeight: 600,
            color: '#111111',
            fontFamily: 'var(--font-body)',
            letterSpacing: '0.05em',
            animationDelay: '0.6s',
          }}
        >
          {formatHoursLines(hours).map(l => `${l.days} · ${l.time}`).join('  |  ')}
        </p>
      </section>

      {/* About */}
      <section style={{ background: 'var(--color-bg-alt)', padding: '5rem 1.25rem' }}>
        <div className="container" style={{ textAlign: 'center' }}>
          <p className="page-subtitle" style={{ color: '#111111', fontWeight: 700 }}>Sobre a profissional</p>
          <h2 className="section-title" style={{ fontSize: '2.25rem', marginBottom: '1.5rem', color: '#111111' }}>{info.professional}</h2>
          <p style={{ maxWidth: '580px', margin: '0 auto', color: '#111111', fontSize: '1.05rem', lineHeight: '1.9', fontWeight: 400 }}>
            Formada em 2017, Joyce dedica mais de 8 anos ao ofício da cabeleireira com
            paixão, técnica e atenção individualizada a cada cliente. Com atendimento
            personalizado no salão <strong>Stay Beautiful</strong>, em Pirapora do Bom Jesus/SP, ela
            transforma cabelos e eleva a autoestima de quem passa por suas mãos.
          </p>
          <DiamondDivider />
          <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '3rem', marginTop: '1rem' }}>
            {[
              { value: '+8', label: 'anos de experiência' },
              { value: '2017', label: 'formada em' },
              { value: '100%', label: 'dedicação e cuidado' },
            ].map(stat => (
              <div key={stat.label} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: '2.5rem', fontWeight: 700, color: '#111111' }}>{stat.value}</div>
                <div style={{ fontFamily: 'var(--font-elegant)', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#111111', marginTop: '0.25rem' }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </>
  )
}
