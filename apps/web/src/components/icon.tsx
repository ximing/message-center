const paths = {
  brand: "M4 5h10v9H4z M10 10h10v9H10 M7 8h4 M13 16h4",
  inbox: "M4 4h16v16H4z M4 13h5l2 3h2l2-3h5",
  route:
    "M5 5h5a3 3 0 0 1 3 3v8a3 3 0 0 0 3 3h3 M5 5v14h4 M17 3l2 2-2 2 M17 17l2 2-2 2",
  layers: "m12 3 9 5-9 5-9-5z M3 12l9 5 9-5 M3 16l9 5 9-5",
  key: "M14 3a6 6 0 1 1-4.5 10L3 20H1v-4l7-7A6 6 0 0 1 14 3z M15 7h.01",
  book: "M3 4h6l3 2 3-2h6v15h-6l-3 2-3-2H3z M12 6v15",
  logout: "M10 4H4v16h6 M9 12h12 M17 8l4 4-4 4",
  chevron: "m9 5 7 7-7 7",
  chevrons: "m9 8 3-3 3 3 M9 16l3 3 3-3",
  plus: "M12 5v14 M5 12h14",
  search: "M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15 M16 16l5 5",
  refresh:
    "M20 7v5h-5 M4 17v-5h5 M5 7a8 8 0 0 1 13-2l2 2 M4 17l2 2a8 8 0 0 0 13-2",
  arrow: "M4 12h16 M16 8l4 4-4 4",
  "arrow-up": "M6 18 18 6 M6 6h12v12",
  check: "m5 12 4 4L19 6",
  close: "m6 6 12 12 M6 18 18 6",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 7v5l3 2",
  alert: "m12 3 10 18H2z M12 9v5 M12 17h.01",
  info: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 11v6 M12 7h.01",
  wechat:
    "M10 4c-5 0-8 3-8 6 0 2 1 3 3 4l-1 3 4-2 M10 4c5 0 8 3 8 6 M15 9c4 0 7 2 7 5 0 2-1 3-3 4l1 3-4-2c-4 0-7-2-7-5s2-5 6-5 M7 8h.01 M12 8h.01 M13 13h.01 M17 13h.01",
  webhook: "m8 6-6 6 6 6 M16 6l6 6-6 6 M14 4l-4 16",
  shield: "m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z m-4 9 3 3 5-6",
  copy: "M9 8h11v13H9z M15 8V3H4v13h5",
  edit: "m15 4 5 5 M4 15 16 3l5 5L9 20l-6 1z",
  filter: "M4 5h16 M7 12h10 M10 19h4",
  file: "M6 3h8l4 4v14H6z M14 3v5h4 M9 12h6 M9 16h6",
  link: "m9 15 6-6 M8 17l-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0 M16 7l1-1a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0",
  image: "M3 3h18v18H3z m0 13 5-5 5 5 3-3 5 5 M15 7h.01",
  voice:
    "M9 4a3 3 0 0 1 6 0v8a3 3 0 0 1-6 0z M5 10v2a7 7 0 0 0 14 0v-2 M12 19v3 M8 22h8",
  lock: "M5 10h14v11H5z M8 10V6a4 4 0 0 1 8 0v4",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6",
} as const;

export type IconName = keyof typeof paths;
export function Icon({
  name,
  className = "",
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}
