interface IconProps {
  d: string;
  size?: number;
  stroke?: number;
}

/** Ícono de trazo con el mismo estilo de líneas del diseño. */
export function Icon({ d, size = 24, stroke = 1.8 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export const ICONS = {
  layers: "M5 18h14 M6.5 14h11 M8 10h8 M9.5 6h5",
  upload: "M12 16V4 M7 9l5-5 5 5 M4 16v4h16v-4",
  bolt: "M13 2L4 14h7l-1 8 9-12h-7z",
  check: "M4 12l5 5L20 6",
  cycle: "M4 4v6h6 M20 20v-6h-6 M5.5 15a7.5 7.5 0 0 0 13 2.5 M18.5 9A7.5 7.5 0 0 0 5.5 6.5",
  stack: "M12 3l9 5-9 5-9-5z M3 13l9 5 9-5 M3 17.5l9 5 9-5",
  box: "M3 7l9-4 9 4v10l-9 4-9-4z M3 7l9 4 9-4 M12 11v10",
  chat: "M4 5h16v11H9l-5 4z",
  expand: "M15 3h6v6 M9 21H3v-6 M21 3l-7 7 M3 21l7-7",
  close: "M6 6l12 12 M18 6L6 18",
  arrows: "M9 6l-6 6 6 6 M15 6l6 6-6 6",
};
