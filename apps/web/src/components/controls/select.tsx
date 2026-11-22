import { createPortal } from "react-dom";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { Icon } from "../icon";
import { onSelectKeyDown } from "./select-keyboard";
import { useSelectPosition } from "./select-position";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}
export interface SelectProps {
  value: string;
  options: readonly SelectOption[];
  onValueChange: (value: string) => void;
  "aria-label": string;
  "aria-describedby"?: string;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
}

/** Select-only combobox: focus stays on the trigger; the popup stays inside its modal. */
export function Select({
  value,
  options,
  onValueChange,
  disabled = false,
  required,
  placeholder = "请选择",
  className = "",
  "aria-label": label,
  "aria-describedby": describedBy,
}: SelectProps) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const typeahead = useRef({ text: "", time: 0 });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [position, setPosition] = useState<CSSProperties>({
    visibility: "hidden",
  });
  const selected = options.find((option) => option.value === value);
  const enabled = options
    .map((option, index) => (option.disabled ? -1 : index))
    .filter((index) => index >= 0);
  const unavailable = () =>
    disabled || !trigger.current || trigger.current.matches(":disabled");
  const show = (index?: number) => {
    if (unavailable()) return;
    const current = options.findIndex(
      (option) => option.value === value && !option.disabled,
    );
    setActive(index ?? (current >= 0 ? current : (enabled[0] ?? -1)));
    typeahead.current = { text: "", time: 0 };
    setOpen(true);
  };
  const choose = (index: number, restoreFocus = true) => {
    const option = options[index];
    if (unavailable() || !option || option.disabled) return;
    onValueChange(option.value);
    setOpen(false);
    if (restoreFocus) trigger.current?.focus();
  };

  useSelectPosition(open, trigger, list, setPosition);

  useEffect(() => {
    if (open && unavailable()) setOpen(false);
  });
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!trigger.current?.contains(target) && !list.current?.contains(target))
        setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  useEffect(() => {
    if (open && active >= 0)
      document
        .getElementById(`${id}-option-${active}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [open, active, id]);

  const onKeyDown = (event: Parameters<typeof onSelectKeyDown>[0]) =>
    onSelectKeyDown(event, {
      open,
      active,
      enabled,
      options,
      unavailable,
      show,
      choose,
      setOpen,
      setActive,
      typeahead,
    });
  const host = trigger.current?.closest("dialog") ?? document.body;
  return (
    <span className={`select-control ${className}`}>
      <button
        ref={trigger}
        type="button"
        role="combobox"
        className="select-trigger"
        disabled={disabled}
        aria-label={label}
        aria-describedby={describedBy}
        aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined}
        aria-haspopup="listbox"
        aria-required={required}
        aria-activedescendant={
          open && active >= 0 ? `${id}-option-${active}` : undefined
        }
        onKeyDown={onKeyDown}
        onBlur={() => setOpen(false)}
        onClick={() => {
          if (open) setOpen(false);
          else show();
        }}
      >
        <span className={`select-value ${!selected ? "is-placeholder" : ""}`}>
          {selected?.label ?? placeholder}
        </span>
        <Icon
          name="chevron"
          className={`select-chevron ${open ? "is-open" : ""}`}
        />
      </button>
      {open &&
        createPortal(
          <ul
            ref={list}
            id={`${id}-list`}
            role="listbox"
            aria-label={label}
            className="select-popover"
            style={position}
            onMouseDown={(e) => e.preventDefault()}
          >
            {options.length ? (
              options.map((option, index) => (
                <li
                  key={option.value}
                  id={`${id}-option-${index}`}
                  role="option"
                  aria-selected={option.value === value}
                  aria-disabled={option.disabled || undefined}
                  className={`select-option ${active === index ? "is-active" : ""} ${option.value === value ? "is-selected" : ""}`}
                  onPointerMove={() => {
                    if (!option.disabled) setActive(index);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    choose(index);
                  }}
                >
                  <span>{option.label}</span>
                  {option.value === value && <Icon name="check" />}
                </li>
              ))
            ) : (
              <li className="select-empty" role="presentation">
                暂无可选项
              </li>
            )}
          </ul>,
          host,
        )}
    </span>
  );
}
