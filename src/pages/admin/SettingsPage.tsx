import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import type { WorkingHours, WorkingHoursDay } from '../../lib/supabase'
import { DAY_NAMES_PT, formatPhone, rawPhone } from '../../lib/utils'
import { DEFAULT_SALON_INFO, formatWhatsapp } from '../../lib/salonInfo'
import type { SalonInfo } from '../../lib/salonInfo'

const DEFAULT_HOURS: WorkingHours = {
  monday:    { open: '14:00', close: '20:00', enabled: true },
  tuesday:   { open: '14:00', close: '20:00', enabled: true },
  wednesday: { open: '14:00', close: '20:00', enabled: true },
  thursday:  { open: '14:00', close: '20:00', enabled: true },
  friday:    { open: '14:00', close: '20:00', enabled: true },
  saturday:  { open: '08:00', close: '18:00', enabled: true },
  sunday:    { open: '08:00', close: '18:00', enabled: false },
}

const DAY_ORDER: (keyof WorkingHours)[] = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
]

export default function AdminSettingsPage() {
  const [hours, setHours] = useState<WorkingHours>(DEFAULT_HOURS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Salon info state
  const [salonInfo, setSalonInfo] = useState<SalonInfo>(DEFAULT_SALON_INFO)
  const [editingInfo, setEditingInfo] = useState(false)
  const [infoDraft, setInfoDraft] = useState<SalonInfo>(DEFAULT_SALON_INFO)
  const [infoSaving, setInfoSaving] = useState(false)
  const [infoMsg, setInfoMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  // Account (login email / password) state
  const [currentAccountEmail, setCurrentAccountEmail] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailMsg, setEmailMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setCurrentAccountEmail(data.user.email)
    })
  }, [])

  async function handleUpdateEmail() {
    if (!newEmail.trim() || !newEmail.includes('@')) {
      setEmailMsg({ type: 'error', text: 'Informe um e-mail válido.' })
      return
    }
    setEmailSaving(true)
    setEmailMsg(null)
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() })
    setEmailSaving(false)
    if (error) {
      setEmailMsg({ type: 'error', text: error.message })
    } else {
      setEmailMsg({ type: 'ok', text: `Enviamos um link de confirmação para ${newEmail.trim()}. O e-mail só muda depois que você clicar nesse link.` })
      setNewEmail('')
    }
  }

  async function handleUpdatePassword() {
    if (newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'A senha deve ter pelo menos 6 caracteres.' })
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'As senhas não coincidem.' })
      return
    }
    setPasswordSaving(true)
    setPasswordMsg(null)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPasswordSaving(false)
    if (error) {
      setPasswordMsg({ type: 'error', text: error.message })
    } else {
      setPasswordMsg({ type: 'ok', text: 'Senha atualizada com sucesso!' })
      setNewPassword('')
      setConfirmPassword('')
    }
  }

  useEffect(() => {
    async function loadSettings() {
      const { data } = await supabase.from('settings').select('*').in('key', ['working_hours', 'salon_info'])
      for (const row of data ?? []) {
        if (row.key === 'working_hours' && row.value) setHours(row.value as WorkingHours)
        if (row.key === 'salon_info' && row.value) setSalonInfo({ ...DEFAULT_SALON_INFO, ...row.value })
      }
      setLoading(false)
    }
    loadSettings()
  }, [])

  function updateDay(day: keyof WorkingHours, field: keyof WorkingHoursDay, value: string | boolean) {
    setHours(h => ({
      ...h,
      [day]: { ...h[day], [field]: value }
    }))
  }

  async function handleSave() {
    setSaving(true)
    await supabase
      .from('settings')
      .upsert({ key: 'working_hours', value: hours, updated_at: new Date().toISOString() })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  function startEditInfo() {
    setInfoDraft({ ...salonInfo, whatsapp: formatPhone(salonInfo.whatsapp) })
    setInfoMsg(null)
    setEditingInfo(true)
  }

  async function handleSaveInfo() {
    const whatsapp = rawPhone(infoDraft.whatsapp)
    const next: SalonInfo = {
      professional: infoDraft.professional.trim(),
      street: infoDraft.street.trim(),
      neighborhood: infoDraft.neighborhood.trim(),
      city: infoDraft.city.trim(),
      whatsapp,
      instagram: infoDraft.instagram.trim().replace(/^@/, ''),
    }
    if (!next.professional || !next.street || !next.city || !next.instagram) {
      setInfoMsg({ type: 'error', text: 'Preencha nome, endereço, cidade e Instagram.' })
      return
    }
    if (whatsapp.length < 10) {
      setInfoMsg({ type: 'error', text: 'Informe um WhatsApp válido com DDD.' })
      return
    }
    setInfoSaving(true)
    const { error } = await supabase
      .from('settings')
      .upsert({ key: 'salon_info', value: next, updated_at: new Date().toISOString() })
    setInfoSaving(false)
    if (error) {
      setInfoMsg({ type: 'error', text: error.message })
    } else {
      setSalonInfo(next)
      setEditingInfo(false)
      setInfoMsg({ type: 'ok', text: 'Informações atualizadas! Já aparecem na tela inicial.' })
    }
  }

  if (loading) return <div className="spinner" />

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem', marginBottom: '0.25rem' }}>Configurações</h1>
      <p style={{ color: 'var(--color-black)', fontSize: '0.9rem', marginBottom: '2rem' }}>
        Horário de funcionamento e conta de acesso
      </p>

      {/* Account (login) Card */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.15rem', marginBottom: '0.25rem' }}>
          Conta de Acesso
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginBottom: '1.25rem' }}>
          E-mail e senha usados para entrar em <code>/admin/login</code>
          {currentAccountEmail && <> — login atual: <strong>{currentAccountEmail}</strong></>}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          {/* Change email */}
          <div>
            <div className="field">
              <label className="label">Novo e-mail</label>
              <input
                type="email"
                className="input"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                placeholder="novoemail@email.com"
                disabled
              />
            </div>
            <p style={{ fontSize: '0.82rem', marginBottom: '0.75rem', color: '#8B0000' }}>
              Temporariamente desativado: a troca de e-mail depende de um link de confirmação por e-mail, e este site ainda não tem envio de e-mail configurado. Use apenas a troca de senha por enquanto.
            </p>
            {emailMsg && (
              <p style={{ fontSize: '0.82rem', marginBottom: '0.75rem', color: emailMsg.type === 'ok' ? '#2d4a2d' : '#8B0000' }}>
                {emailMsg.text}
              </p>
            )}
            <button className="btn btn--sm" onClick={handleUpdateEmail} disabled>
              {emailSaving ? 'Enviando...' : 'Atualizar e-mail'}
            </button>
          </div>

          {/* Change password */}
          <div>
            <div className="field">
              <label className="label">Nova senha</label>
              <input
                type="password"
                className="input"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                autoComplete="new-password"
              />
            </div>
            <div className="field">
              <label className="label">Confirmar nova senha</label>
              <input
                type="password"
                className="input"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repita a senha"
                autoComplete="new-password"
              />
            </div>
            {passwordMsg && (
              <p style={{ fontSize: '0.82rem', marginBottom: '0.75rem', color: passwordMsg.type === 'ok' ? '#2d4a2d' : '#8B0000' }}>
                {passwordMsg.text}
              </p>
            )}
            <button className="btn btn--sm" onClick={handleUpdatePassword} disabled={passwordSaving}>
              {passwordSaving ? 'Salvando...' : 'Atualizar senha'}
            </button>
          </div>
        </div>
      </div>

      {/* Working Hours Card */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.15rem', marginBottom: '1.25rem' }}>
          Horário de Funcionamento
        </h2>

        {DAY_ORDER.map(day => {
          const cfg = hours[day]
          return (
            <div
              key={day}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                flexWrap: 'wrap',
                padding: '0.75rem 0',
                borderBottom: '1px solid var(--color-border)',
                opacity: cfg.enabled ? 1 : 0.5,
              }}
            >
              {/* Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '160px' }}>
                <input
                  type="checkbox"
                  id={`enabled-${day}`}
                  checked={cfg.enabled}
                  onChange={e => updateDay(day, 'enabled', e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor={`enabled-${day}`} style={{ fontFamily: 'var(--font-body)', fontSize: '0.9rem', cursor: 'pointer', fontWeight: 500 }}>
                  {DAY_NAMES_PT[day]}
                </label>
              </div>

              {/* Times */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                <input
                  type="time"
                  className="input"
                  style={{ width: '110px' }}
                  value={cfg.open}
                  disabled={!cfg.enabled}
                  onChange={e => updateDay(day, 'open', e.target.value)}
                />
                <span style={{ color: 'var(--color-black)', fontSize: '0.9rem' }}>às</span>
                <input
                  type="time"
                  className="input"
                  style={{ width: '110px' }}
                  value={cfg.close}
                  disabled={!cfg.enabled}
                  onChange={e => updateDay(day, 'close', e.target.value)}
                />
              </div>
            </div>
          )
        })}

        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button className="btn btn--filled" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar configurações'}
          </button>
          {saved && (
            <span style={{ fontFamily: 'var(--font-elegant)', fontSize: '0.9rem', fontWeight: 600, color: '#2d4a2d' }}>
              ✓ Configurações salvas com sucesso!
            </span>
          )}
        </div>
      </div>

      {/* Salon info card */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.15rem' }}>
            Informações do Salão
          </h2>
          {!editingInfo && (
            <button className="btn btn--sm" onClick={startEditInfo}>Editar informações</button>
          )}
        </div>

        {editingInfo ? (
          <>
            <div className="field">
              <label className="label">Profissional</label>
              <input className="input" value={infoDraft.professional} onChange={e => setInfoDraft(d => ({ ...d, professional: e.target.value }))} />
            </div>
            <div className="field">
              <label className="label">Endereço (rua e número)</label>
              <input className="input" value={infoDraft.street} onChange={e => setInfoDraft(d => ({ ...d, street: e.target.value }))} placeholder="Rua Carmo Vieira, 430" />
            </div>
            <div className="field">
              <label className="label">Bairro</label>
              <input className="input" value={infoDraft.neighborhood} onChange={e => setInfoDraft(d => ({ ...d, neighborhood: e.target.value }))} />
            </div>
            <div className="field">
              <label className="label">Cidade/UF</label>
              <input className="input" value={infoDraft.city} onChange={e => setInfoDraft(d => ({ ...d, city: e.target.value }))} placeholder="Pirapora do Bom Jesus/SP" />
            </div>
            <div className="field">
              <label className="label">WhatsApp</label>
              <input className="input" type="tel" value={infoDraft.whatsapp} onChange={e => setInfoDraft(d => ({ ...d, whatsapp: formatPhone(e.target.value) }))} placeholder="(11) 99999-9999" />
            </div>
            <div className="field">
              <label className="label">Instagram</label>
              <input className="input" value={infoDraft.instagram} onChange={e => setInfoDraft(d => ({ ...d, instagram: e.target.value }))} placeholder="@usuario" />
            </div>
            {infoMsg && (
              <p style={{ fontSize: '0.82rem', marginBottom: '0.75rem', color: infoMsg.type === 'ok' ? '#2d4a2d' : '#8B0000' }}>
                {infoMsg.text}
              </p>
            )}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn--ghost" onClick={() => { setEditingInfo(false); setInfoMsg(null) }} disabled={infoSaving}>Cancelar</button>
              <button className="btn btn--filled" onClick={handleSaveInfo} disabled={infoSaving}>
                {infoSaving ? 'Salvando...' : 'Salvar informações'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.9rem', color: 'var(--color-black)' }}>
              <div><strong>Profissional:</strong> {salonInfo.professional}</div>
              <div><strong>Endereço:</strong> {salonInfo.street} — {salonInfo.neighborhood}, {salonInfo.city}</div>
              <div><strong>WhatsApp:</strong> {formatWhatsapp(salonInfo.whatsapp)}</div>
              <div><strong>Instagram:</strong> @{salonInfo.instagram}</div>
            </div>
            {infoMsg && (
              <p style={{ fontSize: '0.82rem', marginTop: '0.75rem', color: infoMsg.type === 'ok' ? '#2d4a2d' : '#8B0000' }}>
                {infoMsg.text}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
