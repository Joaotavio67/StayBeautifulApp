import { useSalonInfo, formatHoursLines, formatWhatsapp, mapsUrl } from '../lib/salonInfo'

export default function Footer() {
  const { info, hours } = useSalonInfo()

  return (
    <footer className="footer">
      <div className="footer__logo">Stay Beautiful</div>
      <div className="footer__tagline">{info.professional} · {info.city}</div>
      <div className="footer__info">
        <div>
          <div className="footer__info-title">📍 Endereço</div>
          <a href={mapsUrl(info)} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none', borderBottom: '1px solid currentColor' }}>
            {info.street}<br />{info.neighborhood}
          </a>
        </div>
        <div>
          <div className="footer__info-title">🕐 Horários</div>
          {formatHoursLines(hours).map(l => (
            <div key={l.days}>{l.days}: {l.time}</div>
          ))}
        </div>
        <div>
          <div className="footer__info-title">📱 Contato</div>
          {formatWhatsapp(info.whatsapp)}<br />@{info.instagram}
        </div>
      </div>
      <div className="footer__links">
        <a href={`https://wa.me/55${info.whatsapp}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
        <a href={`https://instagram.com/${info.instagram}`} target="_blank" rel="noopener noreferrer">Instagram</a>
        <a href="/agendar">Agendar Horário</a>
        <a href="/admin/login">Área Admin</a>
      </div>
    </footer>
  )
}
