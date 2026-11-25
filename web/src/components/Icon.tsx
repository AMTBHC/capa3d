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
  bag: "M5 8h14l-1.2 12H6.2z M9 8V6a3 3 0 0 1 6 0v2",
  camera: "M4 7h3l2-3h6l2 3h3v12H4z M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  menu: "M4 7h16 M4 12h16 M4 17h16",
  arrow: "M5 12h14 M13 6l6 6-6 6",
  back: "M19 12H5 M11 6l-6 6 6 6",
  plus: "M12 5v14 M5 12h14",
  minus: "M5 12h14",
  trash: "M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13",
  grid: "M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z",
  ruler: "M3 17L17 3l4 4L7 21z M7 13l2 2 M10 10l2 2 M13 7l2 2",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M8.5 12l2.5 2.5 4.5-5",
  truck: "M3 6h11v10H3z M14 10h4l3 3v3h-7 M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z M17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  file: "M6 3h8l4 4v14H6z M14 3v4h4",
};
