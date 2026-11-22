// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Input, Select, Checkbox, Switch } from "./index";

let container: HTMLDivElement;
let root: Root;
const options = [
  { value: "", label: "请选择", disabled: true },
  { value: "wechat", label: "微信" },
  { value: "webhook", label: "Webhook" },
];
const key = (element: Element, value: string) =>
  act(() => {
    element.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: value,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
const click = (element: Element) =>
  act(() => {
    (element as HTMLElement).click();
  });
const combo = () =>
  container.querySelector<HTMLButtonElement>("[role=combobox]")!;

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  Element.prototype.scrollIntoView = vi.fn();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("custom select", () => {
  it("renders no native select and does not change the value until confirmed", () => {
    const change = vi.fn();
    act(() =>
      root.render(
        <Select
          aria-label="来源"
          value="wechat"
          options={options}
          onValueChange={change}
        />,
      ),
    );
    expect(container.querySelector("select")).toBeNull();
    key(combo(), "ArrowDown");
    key(combo(), "ArrowDown");
    expect(change).not.toHaveBeenCalled();
    expect(combo().getAttribute("aria-expanded")).toBe("true");
    key(combo(), "Enter");
    expect(change).toHaveBeenCalledWith("webhook");
    expect(combo().getAttribute("aria-expanded")).toBe("false");
  });
  it("cancels with Escape, skips disabled options, and supports Home/End/typeahead", () => {
    const change = vi.fn();
    act(() =>
      root.render(
        <Select
          aria-label="来源"
          value="webhook"
          options={options}
          onValueChange={change}
        />,
      ),
    );
    key(combo(), "Home");
    expect(
      document.querySelector(".select-option.is-active")?.textContent,
    ).toBe("微信");
    key(combo(), "Escape");
    expect(change).not.toHaveBeenCalled();
    key(combo(), "End");
    expect(
      document.querySelector(".select-option.is-active")?.textContent,
    ).toBe("Webhook");
    key(combo(), "w");
    key(combo(), "Enter");
    expect(change).toHaveBeenCalledWith("webhook");
  });
  it("commits with Tab and dismisses on an outside pointer", () => {
    const change = vi.fn();
    act(() =>
      root.render(
        <Select
          aria-label="来源"
          value="wechat"
          options={options}
          onValueChange={change}
        />,
      ),
    );
    key(combo(), "End");
    key(combo(), "Tab");
    expect(change).toHaveBeenCalledWith("webhook");
    click(combo());
    act(() =>
      document.body.dispatchEvent(new Event("pointerdown", { bubbles: true })),
    );
    expect(combo().getAttribute("aria-expanded")).toBe("false");
  });
  it("keeps its popup in a dialog, closes only the popup on Escape, and commits pointer selection", () => {
    const onEscape = vi.fn(),
      change = vi.fn();
    act(() =>
      root.render(
        <dialog open onKeyDown={onEscape}>
          <Select
            aria-label="来源"
            value="wechat"
            options={options}
            onValueChange={change}
          />
        </dialog>,
      ),
    );
    click(combo());
    expect(container.querySelector("dialog [role=listbox]")).not.toBeNull();
    key(combo(), "Escape");
    expect(onEscape).not.toHaveBeenCalled();
    click(combo());
    click(container.querySelector("[role=option]:last-child")!);
    expect(change).toHaveBeenCalledWith("webhook");
  });
  it("obeys explicit and inherited fieldset disabled states", () => {
    const change = vi.fn();
    act(() =>
      root.render(
        <fieldset disabled>
          <Select
            aria-label="来源"
            value="wechat"
            options={options}
            onValueChange={change}
          />
        </fieldset>,
      ),
    );
    key(combo(), "ArrowDown");
    click(combo());
    expect(document.querySelector("[role=listbox]")).toBeNull();
    act(() =>
      root.render(
        <Select
          disabled
          aria-label="来源"
          value="wechat"
          options={options}
          onValueChange={change}
        />,
      ),
    );
    expect(combo().disabled).toBe(true);
    expect(change).not.toHaveBeenCalled();
  });
});

describe("custom input and toggles", () => {
  it("suppresses native validation UI and exposes an associated inline error", () => {
    act(() =>
      root.render(
        <form>
          <Input aria-label="名称" required value="" onChange={() => {}} />
        </form>,
      ),
    );
    const input = container.querySelector("input")!;
    const event = new Event("invalid", { cancelable: true });
    act(() => input.dispatchEvent(event));
    expect(event.defaultPrevented).toBe(true);
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(
      document.getElementById(input.getAttribute("aria-describedby")!)
        ?.textContent,
    ).toBe("请填写此项");
  });
  it("keeps password content and input focus while toggling visibility without submitting", () => {
    const submit = vi.fn((e) => e.preventDefault());
    act(() =>
      root.render(
        <form onSubmit={submit}>
          <Input
            aria-label="密码"
            type="password"
            value="example-secret"
            onChange={() => {}}
          />
        </form>,
      ),
    );
    click(container.querySelector("button")!);
    expect(container.querySelector("input")?.type).toBe("text");
    expect(container.querySelector("input")?.value).toBe("example-secret");
    expect(document.activeElement).toBe(container.querySelector("input"));
    click(container.querySelector("button")!);
    expect(container.querySelector("input")?.type).toBe("password");
    expect(submit).not.toHaveBeenCalled();
  });
  it("uses button-based controlled toggles and cannot change a disabled fieldset", () => {
    function Toggles() {
      const [checked, setChecked] = useState(false);
      return (
        <>
          <Checkbox label="独占" checked={checked} onChange={setChecked} />
          <Switch label="启用" checked={checked} onChange={setChecked} />
        </>
      );
    }
    act(() => root.render(<Toggles />));
    expect(container.querySelector("input[type=checkbox]")).toBeNull();
    click(container.querySelector("[role=checkbox]")!);
    expect(
      container.querySelector("[role=switch]")?.getAttribute("aria-checked"),
    ).toBe("true");
    click(container.querySelector("[role=switch]")!);
    expect(
      container.querySelector("[role=checkbox]")?.getAttribute("aria-checked"),
    ).toBe("false");
    const change = vi.fn();
    act(() =>
      root.render(
        <fieldset disabled>
          <Switch label="禁用" checked={false} onChange={change} />
        </fieldset>,
      ),
    );
    click(container.querySelector("button")!);
    expect(change).not.toHaveBeenCalled();
  });
});
