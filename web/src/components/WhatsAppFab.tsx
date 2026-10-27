import { whatsappUrl } from "@/lib/config";
import { Icon, ICONS } from "./Icon";

export function WhatsAppFab() {
  return (
    <a className="btn" href={whatsappUrl()} target="_blank" rel="noopener noreferrer" aria-label="Escribir por WhatsApp"
      style={{ position: "fixed", right: 20, bottom: 20, zIndex: 20, display: "flex", alignItems: "center", gap: 8, padding: "14px 20px", borderRadius: 99, background: "#25D366", color: "#06210F", fontWeight: 600, boxShadow: "0 10px 30px rgba(37,211,102,.35)" }}>
      <Icon d={ICONS.chat} size={20} stroke={2} />WhatsApp
    </a>
  );
}
