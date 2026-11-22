import { Icon } from "../icon";

type ToggleProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  "aria-describedby"?: string;
};

export function Switch({
  checked,
  onChange,
  label,
  disabled = false,
  "aria-describedby": describedBy,
}: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-describedby={describedBy}
      className="custom-switch"
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="switch-thumb" />
    </button>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
  disabled = false,
  "aria-describedby": describedBy,
}: ToggleProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      aria-describedby={describedBy}
      className="custom-checkbox"
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      {checked && <Icon name="check" />}
    </button>
  );
}
