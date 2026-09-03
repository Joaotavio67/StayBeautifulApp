import { Link, useLocation } from 'react-router-dom'

const SALON_WHATSAPP = 'https://wa.me/5511997361024'
const SALON_INSTAGRAM = 'https://instagram.com/stay_beautiful.l'

export default function Header() {
  const location = useLocation()
  const isBooking = location.pathname.startsWith('/agendar')

  return (
    <header className="header">
      <div className="header__inner">
        <Link to="/" className="header__logo">Stay Beautiful</Link>
        <nav className="header__nav">
          {!isBooking && (
            <Link to="/agendar">Agendar</Link>
          )}
          <a href={SALON_WHATSAPP} target="_blank" rel="noopener noreferrer">WhatsApp</a>
          <a href={SALON_INSTAGRAM} target="_blank" rel="noopener noreferrer">Instagram</a>
        </nav>
      </div>
    </header>
  )
}
