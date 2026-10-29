"use client";

import { useEffect, useState } from "react";
import { ACCEPT } from "./mesh/load";

/** iPhone y iPad (también el iPad que se presenta como Mac). */
function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/**
 * Filtro del selector de archivos 3D. Safari de iPhone/iPad no reconoce .stl, .3mf, .obj ni
 * .step y los deja en gris, así que allí no se filtra (la extensión se revisa al elegirlo).
 */
export function useModelAccept(): string | undefined {
  const [accept, setAccept] = useState<string | undefined>(ACCEPT);
  useEffect(() => {
    // Se decide después de montar: en el servidor no hay navigator.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isIOS()) setAccept(undefined);
  }, []);
  return accept;
}
