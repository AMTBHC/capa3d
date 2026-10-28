"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/** Botón "Panel" en el menú, solo en el navegador donde el taller ya inició sesión. */
export function AdminShortcut() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShow(!!localStorage.getItem("capa3d-admin"));
    } catch {
      // sin almacenamiento: no se muestra
    }
  }, []);
  if (!show) return null;
  return (
    <Link href="/admin" className="chip-btn" style={{ textDecoration: "none", borderColor: "var(--ac)", color: "var(--ac)" }}>Panel</Link>
  );
}
