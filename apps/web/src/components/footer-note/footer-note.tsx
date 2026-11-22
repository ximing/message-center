import type { ReactNode } from "react";
import { Icon } from "../icon";

export function FooterNote({ children }: { children: ReactNode }) {
  return (
    <div className="footer-note">
      <Icon name="shield" /> {children}
    </div>
  );
}
