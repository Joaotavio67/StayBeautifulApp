import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function AdminLoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error: err } = await supabase.auth.signInWithPassword({ email, password })

    if (err) {
      setError('E-mail ou senha inválidos.')
      setLoading(false)
    } else {
      navigate('/admin/agenda')
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.25rem' }}>
      <Link to="/" style={{ fontFamily: 'var(--font-logo)', fontSize: '2.5rem', color: 'var(--color-black)', marginBottom: '2rem' }}>
        Stay Beautiful
      </Link>

      <p style={{ fontFamily: 'var(--font-elegant)', fontSize: '0.72rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: '2rem' }}>
        Área Administrativa
      </p>

      <div className="card animate-in" style={{ width: '100%', maxWidth: '380px' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.4rem', marginBottom: '1.5rem', textAlign: 'center' }}>
          Entrar
        </h1>

        <form onSubmit={handleLogin}>
          <div className="field">
            <label className="label" htmlFor="email">E-mail</label>
            <input
              id="email"
              className="input"
              type="email"
              placeholder="joycearaujo@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="password">Senha</label>
            <input
              id="password"
              className="input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p style={{ color: '#8B0000', fontFamily: 'var(--font-elegant)', fontSize: '0.85rem', marginBottom: '1rem' }}>
              {error}
            </p>
          )}

          <button type="submit" className="btn btn--filled btn--full" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>

      <div style={{ marginTop: '2rem', textAlign: 'center' }}>
        <Link
          to="/agendar"
          style={{
            fontSize: '0.9rem',
            color: 'var(--color-muted)',
            textDecoration: 'none',
            borderBottom: '1px solid var(--color-muted)',
            display: 'inline-block'
          }}
          title="Voltar para a página de agendamento do cliente"
        >
          👁️ Ver página de agendamento do cliente
        </Link>
      </div>
    </div>
  )
}
