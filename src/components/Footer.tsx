export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer__logo">Stay Beautiful</div>
      <div className="footer__tagline">Joyce Araújo · Pirapora do Bom Jesus/SP</div>
      <div className="footer__info">
        <div>
          <div className="footer__info-title">Endereço</div>
          <a href="https://maps.google.com/?q=Rua+Carmo+Vieira+430+Jardim+Bom+Jesus+Pirapora+do+Bom+Jesus+SP" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none', borderBottom: '1px solid currentColor' }}>
            Rua Carmo Vieira, 430<br />Jardim Bom Jesus
          </a>
        </div>
        <div>
          <div className="footer__info-title">Horários</div>
          Seg – Sex: 14h às 20h<br />Sábado: 8h às 18h
        </div>
        <div>
          <div className="footer__info-title">Contato</div>
          (11) 99736-1024<br />@stay_beautiful.l
        </div>
      </div>
      <div className="footer__links">
        <a href="https://wa.me/5511997361024" target="_blank" rel="noopener noreferrer">WhatsApp</a>
        <a href="https://instagram.com/stay_beautiful.l" target="_blank" rel="noopener noreferrer">Instagram</a>
        <a href="/agendar">Agendar Horário</a>
        <a href="/admin/login">Área Admin</a>
      </div>
    </footer>
  )
}
