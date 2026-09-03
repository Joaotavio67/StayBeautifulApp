import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import type { Service, Combo } from '../../lib/supabase'
import { formatPrice, formatDuration } from '../../lib/utils'

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

type ServiceForm = { name: string; description: string; duration_minutes: string; price: string }
const EMPTY_SERVICE_FORM: ServiceForm = { name: '', description: '', duration_minutes: '', price: '' }

type ComboForm = { name: string; description: string; service_id_1: string; service_id_2: string; service_id_3: string; service_id_4: string; price: string }
const EMPTY_COMBO_FORM: ComboForm = { name: '', description: '', service_id_1: '', service_id_2: '', service_id_3: '', service_id_4: '', price: '' }

const ITEMS_PER_PAGE = 5

export default function AdminServicesPage() {
  const [activeTab, setActiveTab] = useState<'services' | 'combos'>('services')

  // Search & Pagination State
  const [searchQuery, setSearchQuery] = useState('')
  const [servicePage, setServicePage] = useState(1)
  const [comboPage, setComboPage] = useState(1)

  // Services State
  const [services, setServices] = useState<Service[]>([])
  const [loadingServices, setLoadingServices] = useState(true)
  const [serviceModalOpen, setServiceModalOpen] = useState(false)
  const [editingService, setEditingService] = useState<Service | null>(null)
  const [serviceForm, setServiceForm] = useState<ServiceForm>(EMPTY_SERVICE_FORM)
  const [savingService, setSavingService] = useState(false)

  // Combos State
  const [combos, setCombos] = useState<Combo[]>([])
  const [loadingCombos, setLoadingCombos] = useState(true)
  const [comboModalOpen, setComboModalOpen] = useState(false)
  const [editingCombo, setEditingCombo] = useState<Combo | null>(null)
  const [comboForm, setComboForm] = useState<ComboForm>(EMPTY_COMBO_FORM)
  const [savingCombo, setSavingCombo] = useState(false)

  async function loadServices() {
    const { data } = await supabase.from('services').select('*').order('name')
    if (data) setServices(data)
    setLoadingServices(false)
  }

  async function loadCombos() {
    const { data } = await supabase.from('combos').select('*').order('name')
    if (data) setCombos(data as Combo[])
    setLoadingCombos(false)
  }

  useEffect(() => {
    loadServices()
    loadCombos()
  }, [])

  // Reset page when search or tab changes
  useEffect(() => {
    setServicePage(1)
    setComboPage(1)
  }, [searchQuery, activeTab])

  // Service Handlers
  function openCreateService() {
    setEditingService(null)
    setServiceForm(EMPTY_SERVICE_FORM)
    setServiceModalOpen(true)
  }

  function openEditService(svc: Service) {
    setEditingService(svc)
    setServiceForm({
      name: svc.name,
      description: svc.description ?? '',
      duration_minutes: String(svc.duration_minutes),
      price: String(svc.price),
    })
    setServiceModalOpen(true)
  }

  async function handleSaveService() {
    if (!serviceForm.name.trim() || !serviceForm.duration_minutes || !serviceForm.price) {
      alert('Preencha todos os campos obrigatórios.')
      return
    }
    setSavingService(true)
    const payload = {
      name: serviceForm.name.trim(),
      description: serviceForm.description.trim() || null,
      duration_minutes: parseInt(serviceForm.duration_minutes),
      price: parseFloat(serviceForm.price),
    }

    if (editingService) {
      await supabase.from('services').update(payload).eq('id', editingService.id)
    } else {
      await supabase.from('services').insert(payload)
    }

    setSavingService(false)
    setServiceModalOpen(false)
    loadServices()
  }

  async function handleToggleService(svc: Service) {
    await supabase.from('services').update({ is_active: !svc.is_active }).eq('id', svc.id)
    loadServices()
  }

  async function handleDeleteService(id: string) {
    if (!confirm('Excluir este serviço permanentemente?')) return
    await supabase.from('services').delete().eq('id', id)
    loadServices()
  }

  // Combo Handlers
  function openCreateCombo() {
    setEditingCombo(null)
    const defaultId = (i: number) => services[i]?.id || services[0]?.id || ''
    setComboForm({
      ...EMPTY_COMBO_FORM,
      service_id_1: defaultId(0),
      service_id_2: defaultId(1),
      service_id_3: defaultId(2),
      service_id_4: defaultId(3),
    })
    setComboModalOpen(true)
  }

  function openEditCombo(combo: Combo) {
    setEditingCombo(combo)
    setComboForm({
      name: combo.name,
      description: combo.description ?? '',
      service_id_1: combo.service_id_1,
      service_id_2: combo.service_id_2,
      service_id_3: combo.service_id_3,
      service_id_4: combo.service_id_4,
      price: String(combo.price),
    })
    setComboModalOpen(true)
  }

  async function handleSaveCombo() {
    if (!comboForm.name.trim() || !comboForm.service_id_1 || !comboForm.service_id_2 || !comboForm.service_id_3 || !comboForm.service_id_4 || !comboForm.price) {
      alert('Preencha todos os campos obrigatórios do Combo.')
      return
    }
    setSavingCombo(true)
    const payload = {
      name: comboForm.name.trim(),
      description: comboForm.description.trim() || null,
      service_id_1: comboForm.service_id_1,
      service_id_2: comboForm.service_id_2,
      service_id_3: comboForm.service_id_3,
      service_id_4: comboForm.service_id_4,
      price: parseFloat(comboForm.price),
    }

    if (editingCombo) {
      await supabase.from('combos').update(payload).eq('id', editingCombo.id)
    } else {
      await supabase.from('combos').insert(payload)
    }

    setSavingCombo(false)
    setComboModalOpen(false)
    loadCombos()
  }

  async function handleToggleCombo(combo: Combo) {
    await supabase.from('combos').update({ is_active: !combo.is_active }).eq('id', combo.id)
    loadCombos()
  }

  async function handleDeleteCombo(id: string) {
    if (!confirm('Excluir este combo permanentemente?')) return
    await supabase.from('combos').delete().eq('id', id)
    loadCombos()
  }

  // Filtered Lists
  const filteredServices = services.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.description && s.description.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const filteredCombos = combos.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.description && c.description.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  // Paginated Lists
  const totalServicePages = Math.ceil(filteredServices.length / ITEMS_PER_PAGE) || 1
  const paginatedServices = filteredServices.slice((servicePage - 1) * ITEMS_PER_PAGE, servicePage * ITEMS_PER_PAGE)

  const totalComboPages = Math.ceil(filteredCombos.length / ITEMS_PER_PAGE) || 1
  const paginatedCombos = filteredCombos.slice((comboPage - 1) * ITEMS_PER_PAGE, comboPage * ITEMS_PER_PAGE)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem' }}>Serviços & Combos</h1>
          <p style={{ color: 'var(--color-black)', fontSize: '0.9rem' }}>
            Gerencie catálogo com busca e paginação de itens
          </p>
        </div>
        {activeTab === 'services' ? (
          <button className="btn" onClick={openCreateService}>+ Novo serviço</button>
        ) : (
          <button className="btn" onClick={openCreateCombo}>+ Novo Combo (4 Sessões)</button>
        )}
      </div>

      {/* Tabs & Search Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="tabs" style={{ marginBottom: 0 }}>
          <button
            className={`tab${activeTab === 'services' ? ' tab--active' : ''}`}
            onClick={() => setActiveTab('services')}
          >
            Serviços Avulsos ({filteredServices.length})
          </button>
          <button
            className={`tab${activeTab === 'combos' ? ' tab--active' : ''}`}
            onClick={() => setActiveTab('combos')}
          >
            Combos / Pacotes 4 Sessões ({filteredCombos.length})
          </button>
        </div>

        {/* Search Input */}
        <div style={{ minWidth: '240px', flex: 1, maxWidth: '320px' }}>
          <input
            type="text"
            className="input"
            style={{ padding: '0.5rem 0.85rem', fontSize: '0.9rem' }}
            placeholder="🔍 Buscar por nome..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* ── Services Tab ── */}
      {activeTab === 'services' && (
        <div>
          {loadingServices && <div className="spinner" />}
          {!loadingServices && paginatedServices.length === 0 && (
            <p style={{ fontStyle: 'italic', padding: '2rem 0', textAlign: 'center' }}>
              {searchQuery ? 'Nenhum serviço encontrado para essa busca.' : 'Nenhum serviço cadastrado.'}
            </p>
          )}

          {paginatedServices.map(svc => (
            <div key={svc.id} className="appt-card" style={{ opacity: svc.is_active ? 1 : 0.55 }}>
              <div className="appt-card__info">
                <div className="appt-card__name">{svc.name}</div>
                <div className="appt-card__meta">
                  {svc.description && <div style={{ fontStyle: 'italic' }}>{svc.description}</div>}
                  <div>⏱ {formatDuration(svc.duration_minutes)} &nbsp;·&nbsp; 💰 A partir de {formatPrice(svc.price)}</div>
                </div>
              </div>
              <div className="appt-card__actions">
                <span className={`badge badge--${svc.is_active ? 'confirmed' : 'cancelled'}`}>
                  {svc.is_active ? 'Ativo' : 'Inativo'}
                </span>
                <button className="btn btn--sm" onClick={() => openEditService(svc)}>Editar</button>
                <button className="btn btn--sm btn--ghost" onClick={() => handleToggleService(svc)}>
                  {svc.is_active ? 'Desativar' : 'Ativar'}
                </button>
                <button className="btn btn--sm btn--danger" onClick={() => handleDeleteService(svc.id)}>Excluir</button>
              </div>
            </div>
          ))}

          {/* Service Pagination Controls */}
          {totalServicePages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', padding: '0.75rem', background: 'var(--color-bg-alt)', borderRadius: 'var(--radius)' }}>
              <span style={{ fontSize: '0.88rem', color: 'var(--color-black)' }}>
                Página {servicePage} de {totalServicePages} (Total: {filteredServices.length} serviços)
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="btn btn--sm btn--ghost"
                  onClick={() => setServicePage(p => Math.max(1, p - 1))}
                  disabled={servicePage === 1}
                >
                  ← Anterior
                </button>
                <button
                  className="btn btn--sm btn--ghost"
                  onClick={() => setServicePage(p => Math.min(totalServicePages, p + 1))}
                  disabled={servicePage === totalServicePages}
                >
                  Próxima →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Combos Tab ── */}
      {activeTab === 'combos' && (
        <div>
          {loadingCombos && <div className="spinner" />}
          {!loadingCombos && paginatedCombos.length === 0 && (
            <div style={{ padding: '2rem 0', textAlign: 'center' }}>
              <p style={{ fontStyle: 'italic', marginBottom: '1rem' }}>
                {searchQuery ? 'Nenhum combo encontrado para essa busca.' : 'Nenhum combo de 4 sessões cadastrado.'}
              </p>
              {!searchQuery && <button className="btn btn--filled" onClick={openCreateCombo}>+ Criar Primeiro Combo</button>}
            </div>
          )}

          {paginatedCombos.map(combo => {
            const sessionServices = [combo.service_id_1, combo.service_id_2, combo.service_id_3, combo.service_id_4]
              .map(id => services.find(s => s.id === id))
            const totalDuration = sessionServices.reduce((sum, s) => sum + (s?.duration_minutes ?? 60), 0)

            return (
              <div key={combo.id} className="appt-card card--combo" style={{ opacity: combo.is_active ? 1 : 0.55 }}>
                <div className="appt-card__info">
                  <div className="appt-card__name">
                    {combo.name} <span className="badge badge--combo">4 sessões</span>
                  </div>
                  <div className="appt-card__meta">
                    <div>
                      {sessionServices.map((s, idx) => (
                        <span key={idx}>
                          <strong>Sessão {idx + 1}:</strong> {s?.name || '—'}{idx < 3 ? ' · ' : ''}
                        </span>
                      ))}
                    </div>
                    <div>⏱ Duração total do pacote (4 sessões): {formatDuration(totalDuration)}</div>
                    <div>💰 Preço total do pacote (4 sessões): <strong>{formatPrice(combo.price)}</strong></div>
                  </div>
                </div>
                <div className="appt-card__actions">
                  <span className={`badge badge--${combo.is_active ? 'confirmed' : 'cancelled'}`}>
                    {combo.is_active ? 'Ativo' : 'Inativo'}
                  </span>
                  <button className="btn btn--sm" onClick={() => openEditCombo(combo)}>Editar</button>
                  <button className="btn btn--sm btn--ghost" onClick={() => handleToggleCombo(combo)}>
                    {combo.is_active ? 'Desativar' : 'Ativar'}
                  </button>
                  <button className="btn btn--sm btn--danger" onClick={() => handleDeleteCombo(combo.id)}>Excluir</button>
                </div>
              </div>
            )
          })}

          {/* Combo Pagination Controls */}
          {totalComboPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', padding: '0.75rem', background: 'var(--color-bg-alt)', borderRadius: 'var(--radius)' }}>
              <span style={{ fontSize: '0.88rem', color: 'var(--color-black)' }}>
                Página {comboPage} de {totalComboPages} (Total: {filteredCombos.length} combos)
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="btn btn--sm btn--ghost"
                  onClick={() => setComboPage(p => Math.max(1, p - 1))}
                  disabled={comboPage === 1}
                >
                  ← Anterior
                </button>
                <button
                  className="btn btn--sm btn--ghost"
                  onClick={() => setComboPage(p => Math.min(totalComboPages, p + 1))}
                  disabled={comboPage === totalComboPages}
                >
                  Próxima →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Service Modal */}
      {serviceModalOpen && (
        <Modal title={editingService ? 'Editar serviço' : 'Novo serviço'} onClose={() => setServiceModalOpen(false)}>
          <div className="field">
            <label className="label">Nome do serviço *</label>
            <input className="input" value={serviceForm.name} onChange={e => setServiceForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Escova Simples" />
          </div>
          <div className="field">
            <label className="label">Descrição</label>
            <input className="input" value={serviceForm.description} onChange={e => setServiceForm(f => ({ ...f, description: e.target.value }))} placeholder="Descrição breve do serviço" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="field">
              <label className="label">Duração (min) *</label>
              <input className="input" type="number" min="15" step="15" value={serviceForm.duration_minutes} onChange={e => setServiceForm(f => ({ ...f, duration_minutes: e.target.value }))} placeholder="60" />
            </div>
            <div className="field">
              <label className="label">Preço (R$) *</label>
              <input className="input" type="number" min="0" step="0.01" value={serviceForm.price} onChange={e => setServiceForm(f => ({ ...f, price: e.target.value }))} placeholder="80.00" />
            </div>
          </div>
          <div className="modal__actions">
            <button className="btn btn--ghost" onClick={() => setServiceModalOpen(false)}>Cancelar</button>
            <button className="btn btn--filled" onClick={handleSaveService} disabled={savingService}>
              {savingService ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </Modal>
      )}

      {/* Combo Modal */}
      {comboModalOpen && (
        <Modal title={editingCombo ? 'Editar Combo' : 'Novo Combo (Pacote 4 Sessões)'} onClose={() => setComboModalOpen(false)}>
          <div className="field">
            <label className="label">Nome do Combo *</label>
            <input className="input" value={comboForm.name} onChange={e => setComboForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Combo Escova + Hidratação (4 sessões)" />
          </div>
          <div className="field">
            <label className="label">Descrição do pacote</label>
            <input className="input" value={comboForm.description} onChange={e => setComboForm(f => ({ ...f, description: e.target.value }))} placeholder="Ex: Pacote de 4 sessões mensais" />
          </div>

          {([1, 2, 3, 4] as const).map(n => {
            const key = `service_id_${n}` as 'service_id_1' | 'service_id_2' | 'service_id_3' | 'service_id_4'
            return (
              <div className="field" key={n}>
                <label className="label">Serviço da Sessão {n} *</label>
                <select className="input" value={comboForm[key]} onChange={e => setComboForm(f => ({ ...f, [key]: e.target.value }))}>
                  {services.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.duration_minutes} min)</option>
                  ))}
                </select>
              </div>
            )
          })}

          <div className="field">
            <label className="label">Preço Total do Pacote (R$) *</label>
            <input className="input" type="number" min="0" step="0.01" value={comboForm.price} onChange={e => setComboForm(f => ({ ...f, price: e.target.value }))} placeholder="80.00" />
            <span style={{ fontSize: '0.8rem', color: 'var(--color-black)', marginTop: '0.2rem' }}>
              Este é o valor total cobrado pelas 4 sessões juntas.
            </span>
          </div>

          <div className="modal__actions">
            <button className="btn btn--ghost" onClick={() => setComboModalOpen(false)}>Cancelar</button>
            <button className="btn btn--filled" onClick={handleSaveCombo} disabled={savingCombo}>
              {savingCombo ? 'Salvando...' : 'Salvar Combo'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
