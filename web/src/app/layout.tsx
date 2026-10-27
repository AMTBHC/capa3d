import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Unbounded } from "next/font/google";
import "./globals.css";

const display = Unbounded({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display" });
const body = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-body" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Capa3D — Impresión 3D en Colombia",
  description:
    "Sube tu modelo 3D (STL, OBJ, 3MF o STEP), elige material, calidad y color, y conoce tu precio en segundos. Impresión FDM en PLA, PETG, ABS y TPU.",
  openGraph: {
    title: "Capa3D — Impresión 3D",
    description: "Cotiza tu impresión 3D al instante: sube tu archivo y mira tu pieza antes de pedirla.",
    locale: "es_CO",
    type: "website",
  },
};

export const viewport: Viewport = { themeColor: "#0B0B0D" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
