import Link from "next/link";
import { business, whatsappUrl } from "@/lib/config";
import { Logo } from "../brand/Logo";
import { WhatsAppIcon } from "../WhatsAppIcon";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer-in">
        <div style={{ flex: "1 1 260px", maxWidth: 380 }}>
          <Logo height={40} tagline />
          <p style={{ margin: "14px 0 18px", lineHeight: 1.6 }}>
            Impresión 3D para personas y negocios: piezas del catálogo, repuestos y diseños a medida. Envíos a toda Colombia.
          </p>
          <a href={whatsappUrl()} target="_blank" rel="noopener noreferrer" className="btn btn-wa">
            <WhatsAppIcon size={18} />{business.whatsapp ? `+${business.whatsapp}` : "WhatsApp"}
          </a>
          {business.email && <p style={{ margin: "12px 0 0" }}><a href={`mailto:${business.email}`}>{business.email}</a></p>}
        </div>
        <nav aria-label="Tienda" className="footer-col">
          <span className="footer-title">Tienda</span>
          <Link href="/catalogo">Catálogo</Link>
          <Link href="/#a-medida">Pedido a medida</Link>
          <Link href="/#trabajos">Trabajos realizados</Link>
        </nav>
        <nav aria-label="Ayuda" className="footer-col">
          <span className="footer-title">Ayuda</span>
          <Link href="/#como-funciona">Cómo funciona</Link>
          <Link href="/#preguntas">Preguntas frecuentes</Link>
          <Link href="/mis-pedidos">Mis pedidos</Link>
        </nav>
        <nav aria-label="Avanzado" className="footer-col">
          <span className="footer-title">¿Tienes archivo 3D?</span>
          <Link href="/cotizar">Cotizador de archivos STL, 3MF, OBJ y STEP</Link>
          <a href="#">Instagram</a>
          <a href="#">TikTok</a>
        </nav>
      </div>
      <div className="site-footer-bottom">
        <span>© {new Date().getFullYear()} {business.name} · Create beyond limits</span>
        <Link href="/admin">Acceso del taller</Link>
      </div>
    </footer>
  );
}
