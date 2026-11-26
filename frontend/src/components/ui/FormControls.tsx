import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

type FieldProps = {
  label: string;
  hint?: string;
  id: string;
  children: ReactNode;
};

export function Field({ label, hint, id, children }: FieldProps) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      {children}
      {hint && <span className="field__hint">{hint}</span>}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`input ${props.className ?? ""}`.trim()} {...props} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`textarea ${props.className ?? ""}`.trim()} {...props} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`select ${props.className ?? ""}`.trim()} {...props} />;
}

type ChoiceProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export function Checkbox({ label, ...props }: ChoiceProps) {
  return (
    <label className="choice">
      <input type="checkbox" {...props} />
      <span>{label}</span>
    </label>
  );
}

export function Radio({ label, ...props }: ChoiceProps) {
  return (
    <label className="choice">
      <input type="radio" {...props} />
      <span>{label}</span>
    </label>
  );
}
