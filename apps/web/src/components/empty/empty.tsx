import type { ReactNode } from "react";
import { Icon, type IconName } from "../icon";

export function Loading({ text = "正在加载…" }: { text?: string }) {
  return (
    <div className="empty" role="status">
      <span className="spinner" />
      <p>{text}</p>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon = "inbox",
  children,
}: {
  title: string;
  description?: string;
  icon?: IconName;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <Icon name={icon} />
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {children}
    </div>
  );
}
