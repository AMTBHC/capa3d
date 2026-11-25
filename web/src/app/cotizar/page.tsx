import type { Metadata } from "next";
import Link from "next/link";
import { Quoter } from "@/components/quoter/Quoter";

export const metadata: Metadata = {
  title: "Cotizador de archivos 3D · CR3D",
  description: "¿Ya tienes tu modelo 3D? Sube tu STL, OBJ, 3MF o STEP, elige material y calidad, y conoce el precio al instante.",
};

/** Cotizador avanzado: solo para quien ya tiene el archivo 3D. La portada no lo exige. */
export default function QuoterPage() {
  return (
    <main>
      <div className="wrap" style={{ paddingTop: 24 }}>
        <div className="status status-info" style={{ alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ flex: "1 1 260px" }}>
            <strong>¿No tienes un archivo 3D?</strong> No lo necesitas: mándanos una foto o una descripción y nosotros lo diseñamos.
          </span>
          <Link href="/#a-medida" className="btn btn-primary">Pedir con una foto</Link>
        </div>
      </div>
      <Quoter />
    </main>
  );
}
