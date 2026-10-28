import Link from "next/link";
import { business } from "@/lib/config";

export function Footer() {
  const contact = [business.email || "[TU CORREO]", business.whatsapp ? `+${business.whatsapp}` : "[TU WHATSAPP]"].join(" · ");
  return (
    <footer style={{ borderTop: "1px solid var(--line)", padding: "56px 24px 40px" }}>
      <div style={{ maxWidth: "var(--page-max)", margin: "0 auto", display: "flex", flexWrap: "wrap", gap: 40, justifyContent: "space-between" }}>
        <div style={{ flex: "1 1 260px" }}>
          <div className="display" style={{ fontSize: 24, fontWeight: 700 }}>Capa3D</div>
          <p style={{ color: "var(--text-3)", margin: "12px 0 0", lineHeight: 1.6 }}>Impresión 3D FDM para prototipos, repuestos y diseño.<br />{contact}</p>
        </div>
        <div style={{ flex: "1 1 200px" }}>
          <div className="mono label" style={{ marginBottom: 14 }}>FORMATOS ADMITIDOS</div>
          <div className="mono" style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 12 }}>
            {[".STL", ".OBJ", ".3MF", ".STEP"].map((f) => (
              <span key={f} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,.15)" }}>{f}</span>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="mono label" style={{ marginBottom: 4 }}>ENLACES</div>
          <Link href="/mis-pedidos" style={{ color: "var(--text-2)" }}>Mis pedidos</Link>
          <a href="#faq" style={{ color: "var(--text-2)" }}>Preguntas frecuentes</a>
          <a href="#" style={{ color: "var(--text-2)" }}>Instagram</a>
          <a href="#" style={{ color: "var(--text-2)" }}>TikTok</a>
        </div>
      </div>
      <div className="mono" style={{ maxWidth: "var(--page-max)", margin: "40px auto 0", display: "flex", justifyContent: "space-between", gap: 12, fontSize: 11, letterSpacing: 1, color: "var(--text-4)" }}>
        <span>© {new Date().getFullYear()} CAPA3D</span>
        <Link href="/admin" style={{ color: "var(--text-4)" }}>ACCESO DEL TALLER</Link>
      </div>
    </footer>
  );
}
