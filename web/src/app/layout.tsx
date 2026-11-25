import type { Metadata, Viewport } from "next";
import { Inter, Inter_Tight, JetBrains_Mono } from "next/font/google";
import { SiteChrome } from "@/components/site/SiteChrome";
import "./globals.css";

const display = Inter_Tight({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-display" });
const body = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-body" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "CR3D — Piezas, repuestos y regalos impresos en 3D · Colombia",
  description:
    "Elige una pieza del catálogo o mándanos una foto de lo que necesitas: la diseñamos, te confirmamos el precio por WhatsApp y te la enviamos. Sin archivos 3D ni complicaciones.",
  openGraph: {
    title: "CR3D — Impresión 3D sin complicaciones",
    description: "Elige del catálogo o mándanos una foto de lo que necesitas. Lo diseñamos, lo imprimimos y te lo enviamos.",
    locale: "es_CO",
    type: "website",
  },
};

export const viewport: Viewport = { themeColor: "#ffffff" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}
