import type { ReactNode } from "react";

export function Pill({
  children,
  tone = "",
  dot = true,
}: {
  children: ReactNode;
  tone?: string;
  dot?: boolean;
}) {
  return (
    <span className={`pill ${tone}`}>
      {dot && <span className="dot" />}
      {children}
    </span>
  );
}
