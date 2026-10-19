import type { CSSProperties } from "react";
export function StudioIcon({ name, size = 18, style }: { name: string; size?: number; style?: CSSProperties }) {
  const paths: Record<string, React.ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    spark: <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/><path d="m20 2 .7 1.3L22 4l-1.3.7L20 6l-.7-1.3L18 4l1.3-.7Z"/></>,
    chart: <><path d="M4 3v17h17M8 16v-5m5 5V7m5 9V4"/></>,
    data: <><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 4 16 4 16 0V5M4 12v7c0 4 16 4 16 0v-7"/></>,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5"/>,
    back: <path d="M19 12H5m5-5-5 5 5 5"/>,
    plus: <path d="M12 5v14M5 12h14"/>,
    check: <path d="m5 12 4 4L19 6"/>,
    eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
    save: <><path d="M4 3h13l4 4v14H3V3Z"/><path d="M7 3v6h9V3M7 21v-8h10v8"/></>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
    edit: <><path d="m4 16-1 5 5-1L21 7l-4-4Z"/><path d="m14 6 4 4"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21v-3c0-6 16-6 16 0v3"/></>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/></>,
    search: <><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/></>,
    layers: <><path d="m12 3 10 5-10 5L2 8Zm-10 9 10 5 10-5M2 16l10 5 10-5"/></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={style}>{paths[name] ?? paths.grid}</svg>;
}
