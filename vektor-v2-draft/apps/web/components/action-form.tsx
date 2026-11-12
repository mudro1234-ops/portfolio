"use client";
import { createContext, useActionState, useContext, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import clsx from "clsx";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { toast } from "@/components/toast";
import { buttonClass, inputClass, labelClass, type ButtonVariant } from "@/components/ui";

export interface ActionState {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string>;
  data?: Record<string, unknown>;
}
export type FormAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

const ErrorsContext = createContext<Record<string, string>>({});

export function ActionForm({ action, children, className, resetOnSuccess = true, onSuccessData }: {
  action: FormAction;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  onSuccessData?: (data: Record<string, unknown>) => void;
}) {
  const [state, formAction] = useActionState(action, {} as ActionState);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!state.message) return;
    toast(state.message, state.ok ? "success" : "error");
    if (state.ok) {
      if (resetOnSuccess) ref.current?.reset();
      if (state.data && onSuccessData) onSuccessData(state.data);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  return (
    <ErrorsContext.Provider value={state.errors ?? {}}>
      <form ref={ref} action={formAction} className={className}>{children}</form>
    </ErrorsContext.Provider>
  );
}

export function SubmitButton({ children, variant = "primary", pendingLabel = "Saving..." }: {
  children: ReactNode; variant?: ButtonVariant; pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass(variant)}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {pending ? pendingLabel : children}
    </button>
  );
}

export function Field({ label, name, help, children, className }: {
  label: string; name: string; help?: string; children: ReactNode; className?: string;
}) {
  const errors = useContext(ErrorsContext);
  const error = errors[name];
  return (
    <div className={className}>
      <label htmlFor={name} className={labelClass}>{label}</label>
      {children}
      {help && !error && <p className="mt-1 text-xs text-muted">{help}</p>}
      {error && <p role="alert" className="mt-1 text-xs font-medium text-critical">{error}</p>}
    </div>
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { name: string };
export function Input(props: InputProps) {
  const errors = useContext(ErrorsContext);
  return <input id={props.name} {...props} aria-invalid={!!errors[props.name]} className={clsx(inputClass, errors[props.name] && "border-critical", props.className)} />;
}
export function Select({ name, options, defaultValue, required, placeholder }: {
  name: string; options: { value: string; label: string }[]; defaultValue?: string | null; required?: boolean; placeholder?: string;
}) {
  const errors = useContext(ErrorsContext);
  return (
    <select id={name} name={name} required={required} defaultValue={defaultValue ?? ""} aria-invalid={!!errors[name]} className={clsx(inputClass, errors[name] && "border-critical")}>
      {(placeholder !== undefined || !required) && <option value="">{placeholder ?? "Select..."}</option>}
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { name: string }) {
  const errors = useContext(ErrorsContext);
  return <textarea id={props.name} rows={3} {...props} className={clsx(inputClass, errors[props.name] && "border-critical", props.className)} />;
}

/** One-click server action (acknowledge, delete, ...) with optional confirmation + toast. */
export function ActionButton({ action, children, confirm, variant = "secondary", size = "sm", className }: {
  action: () => Promise<ActionState>;
  children: ReactNode;
  confirm?: string;
  variant?: ButtonVariant;
  size?: "sm" | "md";
  className?: string;
}) {
  const [pending, start] = useTransition();
  const [, setTick] = useState(0);
  return (
    <button
      type="button"
      disabled={pending}
      className={clsx(buttonClass(variant, size), className)}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        start(async () => {
          const res = await action();
          if (res.message) toast(res.message, res.ok ? "success" : "error");
          setTick((n) => n + 1);
        });
      }}
    >
      {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
