"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { FloatingActions } from "./FloatingActions";
import { Footer } from "./Footer";
import { Header } from "./Header";

/** Encabezado, pie y botones flotantes en todas las páginas de la tienda (el panel tiene los suyos). */
export function SiteChrome({ children }: { children: ReactNode }) {
  const path = usePathname();
  if (path?.startsWith("/admin")) return <>{children}</>;
  return (
    <>
      <a href="#contenido" className="skip-link">Saltar al contenido</a>
      <Header />
      <div id="contenido">{children}</div>
      <Footer />
      <FloatingActions />
    </>
  );
}
