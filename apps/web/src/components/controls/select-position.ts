import { useLayoutEffect, type CSSProperties, type RefObject } from "react";

/** The popup is portaled out of scrolling containers, but never out of a modal dialog. */
export function useSelectPosition(
  open: boolean,
  trigger: RefObject<HTMLButtonElement | null>,
  list: RefObject<HTMLUListElement | null>,
  setPosition: (position: CSSProperties) => void,
) {
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
  }, [open, list, setPosition, trigger]);
}
