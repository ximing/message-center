import type { ReactNode } from "react";
import { Icon, type IconName } from "../icon";

export function HelpBox({
  icon,
  title,
  children,
}: {
  icon: IconName;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="help-box">
      <Icon name={icon} />
      <div>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
    </div>
  );
}
