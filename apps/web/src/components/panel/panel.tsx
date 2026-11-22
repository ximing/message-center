import type { HTMLAttributes } from "react";

type PanelTag = "section" | "div" | "aside" | "article";

export function Panel({
  as: Tag = "section",
  className,
  ...props
}: HTMLAttributes<HTMLElement> & { as?: PanelTag }) {
  return (
    <Tag className={className ? `panel ${className}` : "panel"} {...props} />
  );
}
