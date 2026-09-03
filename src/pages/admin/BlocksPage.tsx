import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import type { BlockedSlot } from '../../lib/supabase'
import { formatDateBR } from '../../lib/utils'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

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

const EMPTY_FORM = { date: '', startTime: '', endTime: '', reason: '', allDay: true }

export default function AdminBlocksPage() {
  const [blocks, setBlocks] = useState<BlockedSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingBlock, setEditingBlock] = useState<BlockedSlot | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(format(new Date(), 'yyyy-MM'))

  async function load() {
    const { data } = await supabase
      .from('blocked_slots')
      .select('*')
      .order('blocked_date', { ascending: true })
    if (data) setBlocks(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // Group by month (yyyy-MM), like the Histórico page — always includes
  // the current month even if empty, so the selector never looks broken.
  const availableMonths = Array.from(
    new Set([format(new Date(), 'yyyy-MM'), ...blocks.map(b => format(parseISO(b.blocked_date), 'yyyy-MM'))])
  ).sort((a, b) => b.localeCompare(a))

  const monthBlocks = blocks.filter(b => format(parseISO(b.blocked_date), 'yyyy-MM') === selectedMonthKey)

  function openCreate() {
    setEditingBlock(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  function openEdit(block: BlockedSlot) {
    setEditingBlock(block)
    setForm({
      date: block.blocked_date,
      startTime: block.start_time ? block.start_time.slice(0, 5) : '',
      endTime: block.end_time ? block.end_time.slice(0, 5) : '',
      reason: block.reason ?? '',
      allDay: !block.start_time,
    })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.date) { alert('Selecione uma data.'); return }
    if (!form.allDay && (!form.startTime || !form.endTime)) {
      alert('Informe o horário de início e fim.')
      return
    }
    setSaving(true)
    const payload = {
      blocked_date: form.date,
      start_time: form.allDay ? null : form.startTime,
      end_time: form.allDay ? null : form.endTime,
      reason: form.reason.trim() || null,
    }

    if (editingBlock) {
      await supabase.from('blocked_slots').update(payload).eq('id', editingBlock.id)
    } else {
      await supabase.from('blocked_slots').insert(payload)
    }

    setSaving(false)
    setModalOpen(false)
    setEditingBlock(null)
    setForm(EMPTY_FORM)
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover este bloqueio?')) return
    await supabase.from('blocked_slots').delete().eq('id', id)
    load()
  }

  async function handleToggle(block: BlockedSlot) {
    await supabase.from('blocked_slots').update({ is_active: !block.is_active }).eq('id', block.id)
    load()
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem' }}>Bloqueios</h1>
          <p style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-elegant)', fontSize: '0.82rem' }}>
            Bloqueie feriados, folgas ou horários indisponíveis. Bloqueios de dias já passados são desativados automaticamente.
          </p>
        </div>
        <button className="btn" onClick={openCreate}>+ Novo bloqueio</button>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <label className="label" style={{ marginBottom: '0.2rem', display: 'block' }}>Mês / Ano</label>
        <select
          className="input"
          style={{ width: 'auto', padding: '0.5rem 1rem' }}
          value={selectedMonthKey}
          onChange={e => setSelectedMonthKey(e.target.value)}
        >
          {availableMonths.map(mKey => {
            const [y, m] = mKey.split('-').map(Number)
            const d = new Date(y, m - 1, 1)
            return (
              <option key={mKey} value={mKey}>{format(d, "MMMM 'de' yyyy", { locale: ptBR })}</option>
            )
          })}
        </select>
      </div>

      {loading && <div className="spinner" />}

      {!loading && monthBlocks.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-muted)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🔓</div>
          <p style={{ fontFamily: 'var(--font-elegant)', fontStyle: 'italic' }}>Nenhum bloqueio neste mês.</p>
        </div>
      )}

      {monthBlocks.map(block => (
        <div key={block.id} className="appt-card" style={{ opacity: block.is_active ? 1 : 0.55 }}>
          <div className="appt-card__info">
            <div className="appt-card__name">
              📅 {formatDateBR(block.blocked_date)}
              {block.start_time && block.end_time && (
                <span style={{ fontSize: '0.9rem', fontFamily: 'var(--font-body)', fontWeight: 300, marginLeft: '0.5rem' }}>
                  {block.start_time.slice(0, 5)} – {block.end_time.slice(0, 5)}
                </span>
              )}
              {!block.start_time && (
                <span style={{ marginLeft: '0.5rem', fontFamily: 'var(--font-elegant)', fontSize: '0.78rem', color: 'var(--color-muted)' }}>
                  (dia inteiro)
                </span>
              )}
            </div>
            {block.reason && (
              <div className="appt-card__meta">{block.reason}</div>
            )}
          </div>
          <div className="appt-card__actions">
            <span className={`badge badge--${block.is_active ? 'confirmed' : 'cancelled'}`}>
              {block.is_active ? 'Ativo' : 'Inativo (só consulta)'}
            </span>
            <button className="btn btn--sm" onClick={() => openEdit(block)}>
              Editar
            </button>
            <button className="btn btn--sm btn--ghost" onClick={() => handleToggle(block)}>
              {block.is_active ? 'Desativar' : 'Ativar'}
            </button>
            <button className="btn btn--sm btn--danger" onClick={() => handleDelete(block.id)}>
              Remover
            </button>
          </div>
        </div>
      ))}

      {modalOpen && (
        <Modal title={editingBlock ? 'Editar bloqueio' : 'Novo bloqueio'} onClose={() => { setModalOpen(false); setEditingBlock(null) }}>
          <div className="field">
            <label className="label">Data *</label>
            <input
              className="input"
              type="date"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
            />
          </div>

          <div className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.75rem' }}>
            <input
              id="allday"
              type="checkbox"
              checked={form.allDay}
              onChange={e => setForm(f => ({ ...f, allDay: e.target.checked }))}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
            <label htmlFor="allday" className="label" style={{ margin: 0 }}>Bloquear o dia inteiro</label>
          </div>

          {!form.allDay && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="field">
                <label className="label">Início</label>
                <input className="input" type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
              </div>
              <div className="field">
                <label className="label">Fim</label>
                <input className="input" type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
              </div>
            </div>
          )}

          <div className="field">
            <label className="label">Motivo (opcional)</label>
            <input className="input" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="Ex: Feriado nacional, folga, ..." />
          </div>

          <div className="modal__actions">
            <button className="btn btn--ghost" onClick={() => { setModalOpen(false); setEditingBlock(null) }}>Cancelar</button>
            <button className="btn btn--filled" onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : editingBlock ? 'Salvar alterações' : 'Salvar'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
