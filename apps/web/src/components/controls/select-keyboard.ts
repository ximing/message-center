import type { KeyboardEvent } from "react";
import type { SelectOption } from "./select";

type KeyState = {
  open: boolean;
  active: number;
  enabled: number[];
  options: readonly SelectOption[];
  unavailable: () => boolean;
  show: (index?: number) => void;
  choose: (index: number, restoreFocus?: boolean) => void;
  setOpen: (open: boolean) => void;
  setActive: (index: number) => void;
  typeahead: { current: { text: string; time: number } };
};

export function onSelectKeyDown(
  event: KeyboardEvent<HTMLButtonElement>,
  ctx: KeyState,
) {
  if (ctx.unavailable() || event.nativeEvent.isComposing) return;
  const key = event.key;
  if (key === "Escape" && ctx.open) {
    event.preventDefault();
    event.stopPropagation();
    ctx.setOpen(false);
    return;
  }
  if (key === "Tab") {
    if (ctx.open) {
      if (ctx.active >= 0) ctx.choose(ctx.active, false);
      else ctx.setOpen(false);
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
      if (ctx.open) ctx.choose(ctx.active);
      else ctx.show();
      return;
    }
    if (key === "Home" || key === "End") {
      const index = key === "Home" ? ctx.enabled[0] : ctx.enabled.at(-1);
      if (ctx.open) ctx.setActive(index ?? -1);
      else ctx.show(index);
      return;
    }
    if (event.altKey && key === "ArrowUp" && ctx.open) {
      ctx.choose(ctx.active);
      return;
    }
    if (!ctx.open) {
      ctx.show();
      return;
    }
    const offset =
      key === "PageDown" ? 10 : key === "PageUp" ? -10 : key === "ArrowDown" ? 1 : -1;
    ctx.setActive(
      ctx.enabled[
        Math.max(
          0,
          Math.min(ctx.enabled.length - 1, ctx.enabled.indexOf(ctx.active) + offset),
        )
      ] ?? -1,
    );
    return;
  }
  if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault();
    const now = Date.now();
    const previous = ctx.typeahead.current;
    const text = now - previous.time < 700 ? previous.text + key : key;
    ctx.typeahead.current = { text, time: now };
    const query = Array.from(text).every((char) => char === key) ? key : text;
    const indexes = [
      ...ctx.enabled.filter((index) => index > ctx.active),
      ...ctx.enabled.filter((index) => index <= ctx.active),
    ];
    const found = indexes.find((index) =>
      ctx.options[index]?.label
        .toLocaleLowerCase()
        .startsWith(query.toLocaleLowerCase()),
    );
    if (!ctx.open) ctx.setOpen(true);
    if (found !== undefined) ctx.setActive(found);
  }
}
