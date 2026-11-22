import type { ReactNode } from "react";

export function Field({
  label,
  optional = false,
  children,
}: {
  label: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>
        {label}
        {optional && (
          <>
            {" "}
            <span className="optional">可选</span>
          </>
        )}
      </span>
      {children}
    </label>
  );
}

export function FieldGroup({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="field-group">
      {title && <h3>{title}</h3>}
      {children}
    </div>
  );
}

export function CheckSetting({
  label,
  children,
}: {
  label: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="check-setting">
      {label}
      {children}
    </div>
  );
}
