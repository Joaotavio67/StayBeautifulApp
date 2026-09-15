export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer__logo">Stay Beautiful</div>
      <div className="footer__tagline">Joyce Araújo · Pirapora do Bom Jesus/SP</div>
      <div className="footer__links">
        <a href="https://wa.me/5511997361024" target="_blank" rel="noopener noreferrer">WhatsApp</a>
        <a href="https://instagram.com/stay_beautiful.l" target="_blank" rel="noopener noreferrer">Instagram</a>
        <a href="/agendar">Agendar Horário</a>
        <a href="/admin/login">Área Admin</a>
      </div>
      <div className="footer__copy">
        <a href="https://maps.google.com/?q=Rua+Carmo+Vieira+430+Jardim+Bom+Jesus+Pirapora+do+Bom+Jesus+SP" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none', borderBottom: '1px solid currentColor', cursor: 'pointer' }}>
          Rua Carmo Vieira, 430 — Jardim Bom Jesus, Pirapora do Bom Jesus/SP
        </a>
      </div>
    </footer>
  )
}
