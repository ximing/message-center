import {
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { Icon, type IconName } from "../icon";

function validationMessage(
  input: HTMLInputElement | HTMLTextAreaElement,
): string {
  if (input.validity.valueMissing) return "请填写此项";
  if (input.validity.typeMismatch)
    return input instanceof HTMLInputElement && input.type === "email"
      ? "请输入有效的邮箱地址"
      : "请输入有效的地址";
  if (input.validity.tooShort) return `至少需要 ${input.minLength} 个字符`;
  if (input.validity.patternMismatch) return "请按照要求填写";
  return "请检查输入内容";
}

function focusFirstInvalid(input: HTMLInputElement | HTMLTextAreaElement) {
  const firstInvalid = Array.from(input.form?.elements ?? []).find(
    (element) =>
      (element instanceof HTMLInputElement ||
        element instanceof HTMLTextAreaElement) &&
      element.willValidate &&
      !element.validity.valid,
  );
  if (firstInvalid === input && document.activeElement !== input) input.focus();
}

type InputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "size"
> & {
  type?: "text" | "email" | "password" | "url" | "search" | "tel";
  leadingIcon?: IconName;
  error?: string;
};

/** Native editing semantics (IME/autofill), with entirely application-owned chrome. */
export function Input({
  className = "",
  type = "text",
  leadingIcon,
  error,
  onChange,
  onInvalid,
  onBlur,
  "aria-describedby": describedBy,
  ...props
}: InputProps) {
  const ref = useRef<HTMLInputElement>(null);
  const errorId = useId();
  const [validation, setValidation] = useState("");
  const [visible, setVisible] = useState(false);
  const message = error || validation;
  const isPassword = type === "password";
  return (
    <span className={`text-control ${className}`}>
      <span className={`input-shell ${message ? "is-invalid" : ""}`}>
        {leadingIcon && (
          <span className="input-leading">
            <Icon name={leadingIcon} />
          </span>
        )}
        <input
          {...props}
          ref={ref}
          className="control-input"
          type={isPassword && visible ? "text" : type}
          aria-invalid={message ? true : props["aria-invalid"]}
          aria-describedby={
            [describedBy, message ? errorId : ""].filter(Boolean).join(" ") ||
            undefined
          }
          onChange={(e) => {
            setValidation("");
            onChange?.(e);
          }}
          onBlur={(e) => {
            if (e.target.value && !e.target.validity.valid)
              setValidation(validationMessage(e.target));
            onBlur?.(e);
          }}
          onInvalid={(e) => {
            e.preventDefault();
            setValidation(validationMessage(e.currentTarget));
            focusFirstInvalid(e.currentTarget);
            onInvalid?.(e);
          }}
        />
        {isPassword && (
          <button
            type="button"
            className="input-action"
            disabled={props.disabled}
            aria-label={visible ? "隐藏密码或令牌" : "显示密码或令牌"}
            aria-pressed={visible}
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.preventDefault();
              setVisible(!visible);
              ref.current?.focus();
            }}
          >
            <Icon name="eye" />
            <span className="password-action-text">
              {visible ? "隐藏" : "显示"}
            </span>
          </button>
        )}
      </span>
      {message && (
        <span id={errorId} className="control-error" role="alert">
          {message}
        </span>
      )}
    </span>
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  error?: string;
};
export function Textarea({
  className = "",
  error,
  onChange,
  onInvalid,
  "aria-describedby": describedBy,
  ...props
}: TextareaProps) {
  const errorId = useId();
  const [validation, setValidation] = useState("");
  const message = error || validation;
  return (
    <span className={`text-control ${className}`}>
      <span
        className={`input-shell textarea-shell ${message ? "is-invalid" : ""}`}
      >
        <textarea
          {...props}
          className="control-textarea"
          aria-invalid={message ? true : props["aria-invalid"]}
          aria-describedby={
            [describedBy, message ? errorId : ""].filter(Boolean).join(" ") ||
            undefined
          }
          onChange={(e) => {
            setValidation("");
            onChange?.(e);
          }}
          onInvalid={(e) => {
            e.preventDefault();
            setValidation(validationMessage(e.currentTarget));
            focusFirstInvalid(e.currentTarget);
            onInvalid?.(e);
          }}
        />
      </span>
      {message && (
        <span id={errorId} className="control-error" role="alert">
          {message}
        </span>
      )}
    </span>
  );
}
