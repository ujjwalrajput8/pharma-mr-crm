import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  ReactNode,
} from 'react';
import { cn } from '@/utils/cn';
import { fieldControlClass, fieldLabelClass } from '@/components/ui/formStyles';

interface FieldShellProps {
  label: string;
  className?: string;
  htmlFor: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}

function FieldShell({ label, className, htmlFor, hint, required, children }: FieldShellProps) {
  return (
    <div className={cn('block', className)}>
      <label htmlFor={htmlFor} className={cn(fieldLabelClass, 'flex items-center gap-1')}>
        {label}
        {required ? <span className="text-[var(--color-danger)]">*</span> : null}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint ? <p className="mt-1 text-[11px] text-[var(--color-muted)]">{hint}</p> : null}
    </div>
  );
}

interface FieldProps {
  label: string;
  className?: string;
  hint?: string;
}

export function Input({
  label,
  className,
  id,
  type,
  hint,
  required,
  ...props
}: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  if (type === 'date' || type === 'time' || type === 'datetime-local') {
    throw new Error('Use DatePicker / TimePicker instead of native date/time inputs');
  }
  const inputId = id ?? props.name ?? label;
  return (
    <FieldShell
      label={label}
      className={className}
      htmlFor={inputId}
      hint={hint}
      required={required}
    >
      <input id={inputId} type={type} required={required} className={fieldControlClass} {...props} />
    </FieldShell>
  );
}

export function Select({
  label,
  className,
  id,
  children,
  hint,
  required,
  ...props
}: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const selectId = id ?? props.name ?? label;
  return (
    <FieldShell
      label={label}
      className={className}
      htmlFor={selectId}
      hint={hint}
      required={required}
    >
      <select id={selectId} required={required} className={fieldControlClass} {...props}>
        {children}
      </select>
    </FieldShell>
  );
}

export function Textarea({
  label,
  className,
  id,
  hint,
  required,
  ...props
}: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const areaId = id ?? props.name ?? label;
  return (
    <FieldShell
      label={label}
      className={className}
      htmlFor={areaId}
      hint={hint}
      required={required}
    >
      <textarea
        id={areaId}
        required={required}
        className={cn(fieldControlClass, 'h-auto min-h-[5.5rem] resize-y py-2 leading-relaxed')}
        {...props}
      />
    </FieldShell>
  );
}
