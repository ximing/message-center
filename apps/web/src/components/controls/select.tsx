import { createPortal } from "react-dom";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { Icon } from "../icon";

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

  // The popup is portaled out of scrolling containers, but never out of a modal dialog.
  useLayoutEffect(() => {
    if (!open) return;
    const reposition = () => {
      if (!trigger.current) return;
      const rect = trigger.current.getBoundingClientRect();
      const viewport = window.visualViewport;
      const viewTop = viewport?.offsetTop ?? 0;
      const viewLeft = viewport?.offsetLeft ?? 0;
      const viewHeight = viewport?.height ?? window.innerHeight;
      const viewWidth = viewport?.width ?? window.innerWidth;
      const below = viewTop + viewHeight - rect.bottom - 12;
      const above = rect.top - viewTop - 12;
      const upward = below < 200 && above > below;
      const maxHeight = Math.max(60, Math.min(280, upward ? above : below));
      const width = Math.min(Math.max(rect.width, 170), viewWidth - 24);
      const left = Math.max(
        viewLeft + 12,
        Math.min(rect.left, viewLeft + viewWidth - width - 12),
      );
      setPosition({
        position: "fixed",
        left,
        width,
        maxHeight,
        ...(upward
          ? { top: "auto", bottom: window.innerHeight - rect.top + 6 }
          : { top: rect.bottom + 6, bottom: "auto" }),
      });
    };
    reposition();
    const resize = new ResizeObserver(reposition);
    if (trigger.current) resize.observe(trigger.current);
    window.addEventListener("resize", reposition);
    // Don't reposition in response to the listbox's own keyboard scrolling.
    const onScroll = (event: Event) => {
      if (!list.current?.contains(event.target as Node)) reposition();
    };
    window.addEventListener("scroll", onScroll, true);
    window.visualViewport?.addEventListener("resize", reposition);
    return () => {
      resize.disconnect();
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", onScroll, true);
      window.visualViewport?.removeEventListener("resize", reposition);
    };
  }, [open]);

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

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (unavailable() || event.nativeEvent.isComposing) return;
    const key = event.key;
    if (key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      return;
    }
    if (key === "Tab") {
      if (open) {
        if (active >= 0) choose(active, false);
        else setOpen(false);
      }
      return;
    }
    if (
      [
        "Enter",
        " ",
        "ArrowDown",
        "ArrowUp",
        "Home",
        "End",
        "PageDown",
        "PageUp",
      ].includes(key)
    ) {
      event.preventDefault();
      if (key === "Enter" || key === " ") {
        if (open) choose(active);
        else show();
        return;
      }
      if (key === "Home" || key === "End") {
        const index = key === "Home" ? enabled[0] : enabled.at(-1);
        if (open) setActive(index ?? -1);
        else show(index);
        return;
      }
      if (event.altKey && key === "ArrowUp" && open) {
        choose(active);
        return;
      }
      if (!open) {
        show();
        return;
      }
      const offset =
        key === "PageDown"
          ? 10
          : key === "PageUp"
            ? -10
            : key === "ArrowDown"
              ? 1
              : -1;
      setActive(
        enabled[
          Math.max(
            0,
            Math.min(enabled.length - 1, enabled.indexOf(active) + offset),
          )
        ] ?? -1,
      );
      return;
    }
    if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      const now = Date.now();
      const text =
        now - typeahead.current.time < 700 ? typeahead.current.text + key : key;
      typeahead.current = { text, time: now };
      const query = Array.from(text).every((char) => char === key) ? key : text;
      const indexes = [
        ...enabled.filter((index) => index > active),
        ...enabled.filter((index) => index <= active),
      ];
      const found = indexes.find((index) =>
        options[index]?.label
          .toLocaleLowerCase()
          .startsWith(query.toLocaleLowerCase()),
      );
      if (!open) setOpen(true);
      if (found !== undefined) setActive(found);
    }
  };
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
