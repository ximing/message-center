import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "danger";
type Size = "small";

export function buttonClass(
  variant?: Variant,
  size?: Size,
  className?: string,
) {
  return ["btn", variant, size, className].filter(Boolean).join(" ");
}

export function textLinkClass(className?: string) {
  return ["text-link", className].filter(Boolean).join(" ");
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export function Button({
  variant,
  size,
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass(variant, size, className)}
      {...props}
    />
  );
}

export function IconButton({
  label,
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type={type}
      aria-label={label}
      className={className ? `icon-btn ${className}` : "icon-btn"}
      {...props}
    />
  );
}

export function TextLink({
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={textLinkClass(className)}
      {...props}
    />
  );
}
